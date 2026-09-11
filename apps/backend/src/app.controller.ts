import {
  Controller,
  Post,
  Body,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  InternalServerErrorException,
  UseGuards,
  Inject,
  Req,
  Param,
  Delete,
  Query,
  Patch,
  Get,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from './auth.guard';
import { AppService } from './app.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import pdfParse from 'pdf-parse';
import { generateText, streamText, ToolSet, isStepCount, tool, ModelMessage } from 'ai';
import { z } from 'zod';
import { google } from '@ai-sdk/google';
import { RagService } from './rag.service';
import { McpClientService } from './mcp-client.service';
import { RAG_QUEUE_NAME, getJobCancelKey, redisClient } from './constants';
import { ChatRequestDto, ChatHistoryQueryDto, RenameSessionDto, ChatSessionParamDto } from './dtos/chat.dto';
import { DocumentJobParamDto } from './dtos/document.dto';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface AuthRequest {
  user: {
    sub: string;
  };
}

@Controller('api')
@UseGuards(AuthGuard)
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly ragService: RagService,
    private readonly mcpClientService: McpClientService,
    @InjectQueue(RAG_QUEUE_NAME) private readonly ragQueue: Queue,
  ) {}

  @Post('chat')
  async chat(
    @Req() req: AuthRequest,
    @Body() body: ChatRequestDto,
    @Res() res: Response
  ) {
    const { messages } = body;
    const sanitizedMessages = messages.filter(
      (msg) =>
        msg.content !== undefined &&
        msg.content !== null &&
        msg.role !== 'system',
    );
    const latestMessage =
      sanitizedMessages[sanitizedMessages.length - 1]?.content || '';

    // Extract Clerk User ID
    const userId = req.user.sub;

    // Ensure User exists in DB
    await this.appService.ensureUserExists(userId);

    // Session Management
    const currentSessionId = await this.appService.getOrCreateSession(
      userId,
      body.sessionId,
      latestMessage,
    );

    // Save User Message
    await this.appService.saveMessage(currentSessionId, 'user', latestMessage);

    // 1. Instantly open the stream so the frontend can receive real-time updates!
    // Pass sessionId to frontend via header (MUST be before flushHeaders)
    res.setHeader('x-session-id', currentSessionId);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders(); // CRITICAL: Force headers to be sent immediately so the frontend fetch doesn't hang!

    // 2. Fetch MCP Tools from Memory Cache
    console.time('MCP Tool Fetch');
    const mcpTools = (await this.mcpClientService.getAiSdkTools()) as ToolSet;
    console.timeEnd('MCP Tool Fetch');

    // 3. Define the Agentic RAG Tool
    const ragTool = {
      search_knowledge_base: {
        description: 'Search the internal company knowledge base for documents, policies, or facts.',
        parameters: z.object({
          query: z.string().describe('The search query to look up in the knowledge base.'),
        }),
        execute: async ({ query }: { query: string }) => {
          console.log(`[RAG Tool] AI is searching for: "${query}"`);
          const results = await this.ragService.retrieveContext(query, userId);
          return results.length > 0
            ? results.join('\n\n')
            : 'No relevant information found in the knowledge base.';
        },
      } as any,
    };

    // Combine MCP tools and Native tools
    const combinedTools: ToolSet = {
      ...mcpTools,
      ...ragTool,
    };

    const currentMessages: ModelMessage[] = [
      ...sanitizedMessages,
    ] as ModelMessage[];

    try {
      const result = streamText({
        model: google('gemini-3.6-flash'),
        maxRetries: 0, // Prevent 45-second silent hangs when API quota is hit
        system: `You are a helpful company assistant. You can use available tools to look up external information or search the internal company knowledge base. Always use tools when you need to verify facts. Do NOT introduce yourself as an AI built by Google, and do not use repetitive generic greetings. Provide direct, natural responses without preamble.`,
        messages: currentMessages,
        tools: combinedTools,
        stopWhen: isStepCount(5), // Automatically loops for tool calls!
        onFinish: async ({ text }) => {
          // Save Assistant Message
          await this.appService.saveMessage(
            currentSessionId,
            'assistant',
            text || '',
          );

          // Background Task: Auto-generate title for new sessions
          if (!body.sessionId) {
            this.generateAndSaveTitle(
              userId, 
              currentSessionId, 
              latestMessage, 
              text || ''
            ).catch(e => console.error('Background title generation failed', e));
          }
        }
      });

      console.time('First Stream Chunk');
      let isFirstChunk = true;

      for await (const part of result.fullStream) {
        if (isFirstChunk) {
          console.timeEnd('First Stream Chunk');
          isFirstChunk = false;
        }
        
        if (part.type === 'text-delta') {
          res.write(part.text);
        } else if (part.type === 'tool-call') {
          res.write(`\n\n_⚙️ Executing Tool: ${part.toolName}..._\n\n`);
        } else if (part.type === 'error') {
          console.error('AI Stream Error (Part):', part.error);
          const errMsg = part.error instanceof Error ? part.error.message : String(part.error);
          res.write(`\n\n**Error:** The AI service encountered an issue. ${errMsg}\n\n`);
        }
      }
    } catch (error: any) {
      console.error('AI Stream Error:', error);
      res.write(`\n\n**Error:** The AI service encountered an issue. ${error.message || 'Please try again later.'}\n\n`);
    } finally {
      res.end();
    }
  }

  private async generateAndSaveTitle(userId: string, sessionId: string, userMessage: string, assistantMessage: string) {
    try {
      const summaryResult = await generateText({
        model: google('gemini-3.6-flash'),
        system: 'You are a helpful assistant that generates a concise, 2-5 word title for a chat session based on the first interaction. Do not use quotes or prefixes like "Title:".',
        prompt: `User: ${userMessage}\nAssistant: ${assistantMessage}`,
      });
      
      const title = summaryResult.text.trim().replace(/^["']|["']$/g, '');
      if (title) {
        await this.appService.renameSession(userId, sessionId, title);
      }
    } catch (e) {
      console.error('Failed to generate session title:', e);
    }
  }

  @Get('chat/history')
  async getChatHistory(
    @Req() req: AuthRequest,
    @Query() query: ChatHistoryQueryDto,
  ) {
    const { page, sessionId } = query;
    const userId = req.user.sub;
    const pageNum = parseInt(page, 10) || 1;
    const limit = 20;

    console.log(
      `[DEBUG] Fetching chat history for user: ${userId}, page: ${pageNum}, session: ${sessionId || 'latest'}`,
    );

    return await this.appService.getPaginatedHistory(
      userId,
      pageNum,
      limit,
      sessionId,
    );
  }

  @Get('chat/sessions')
  async getChatSessions(@Req() req: AuthRequest) {
    const userId = req.user.sub;
    const sessions = await this.appService.getSessions(userId);
    return { sessions };
  }

  @Patch('chat/sessions/:id')
  async renameSession(
    @Req() req: AuthRequest,
    @Param() param: ChatSessionParamDto,
    @Body() body: RenameSessionDto,
  ) {
    const sessionId = param.id;
    const userId = req.user.sub;
    if (!body.title || !body.title.trim()) {
      throw new BadRequestException('Title cannot be empty');
    }

    // Validate session ownership before renaming
    const history = await this.appService.getPaginatedHistory(
      userId,
      1,
      1,
      sessionId,
    );
    if (!history.sessionId) {
      throw new BadRequestException('Session not found or access denied');
    }

    await this.appService.renameSession(userId, sessionId, body.title.trim());
    return { success: true };
  }

  @Delete('chat/sessions/:id')
  async deleteSession(@Req() req: AuthRequest, @Param() param: ChatSessionParamDto) {
    const sessionId = param.id;
    const userId = req.user.sub;
    await this.appService.deleteSession(userId, sessionId);
    return { success: true };
  }

  @Post('documents')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(
    @Req() req: AuthRequest,
    @UploadedFile() file: Express.Multer.File,
  ) {
    try {
      if (!file) {
        throw new BadRequestException('No file provided');
      }

      let textContent = '';

      if (file.mimetype === 'application/pdf') {
        try {
          const data = await pdfParse(file.buffer);
          textContent = data.text;
        } catch (pdfError) {
          console.error('PDF_PARSE_ERROR:', pdfError);
          throw new BadRequestException('Failed to parse PDF file');
        }
      } else if (
        file.mimetype.startsWith('text/') ||
        file.mimetype === 'application/json' ||
        file.mimetype === 'application/csv' ||
        file.originalname.endsWith('.txt') ||
        file.originalname.endsWith('.md')
      ) {
        textContent = file.buffer.toString('utf-8');
      } else {
        throw new BadRequestException(
          `Unsupported file type: ${file.mimetype}`,
        );
      }

      if (!textContent.trim()) {
        throw new BadRequestException('Extracted text is empty');
      }

      const userId = req.user.sub;
      const job = await this.ragQueue.add('process-pdf', {
        textContent,
        originalname: file.originalname,
        userId,
      });

      return {
        message: 'Document enqueued for processing',
        jobId: job.id,
        filename: file.originalname,
      };
    } catch (error) {
      console.error('UPLOAD_CRASH:', error);
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Upload failed',
      );
    }
  }

  @Get('documents/status/:jobId')
  async getJobStatus(@Param() param: DocumentJobParamDto) {
    const jobId = param.jobId;
    const job = await this.ragQueue.getJob(jobId);
    if (!job) {
      throw new BadRequestException('Job not found');
    }

    const state = await job.getState();
    const progress = job.progress;

    return {
      jobId: job.id,
      state,
      progress,
      result: job.returnvalue as number | null,
      failedReason: job.failedReason,
    };
  }

  @Delete('documents/cancel/:jobId')
  async cancelJob(@Param() param: DocumentJobParamDto) {
    const jobId = param.jobId;
    const job = await this.ragQueue.getJob(jobId);
    if (job) {
      // Set a Redis flag that the worker can check periodically
      const cancelKey = getJobCancelKey(jobId);
      await redisClient.set(cancelKey, '1', 'EX', 3600); // Expire in 1 hour

      return { message: 'Job cancellation requested' };
    }
    throw new BadRequestException('Job not found');
  }
}
