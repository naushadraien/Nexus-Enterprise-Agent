import {
  Controller,
  Post,
  Body,
  BadRequestException,
  UseGuards,
  Req,
  Param,
  Delete,
  Query,
  Patch,
  Get,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard } from '../../common/guards/auth.guard';
import { SessionService } from '../session/session.service';
import { ChatService } from './chat.service';
import type { ModelMessage } from 'ai';
import {
  ChatRequestDto,
  ChatHistoryQueryDto,
  RenameSessionDto,
  ChatSessionParamDto,
} from './dto/chat.dto';

interface AuthRequest {
  user: {
    sub: string;
  };
}

@Controller('api/chat')
@UseGuards(AuthGuard)
export class ChatController {
  constructor(
    private readonly sessionService: SessionService,
    private readonly chatService: ChatService,
  ) {}

  @Post()
  async chat(
    @Req() req: AuthRequest,
    @Body() body: ChatRequestDto,
    @Res() res: Response,
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
    await this.sessionService.ensureUserExists(userId);

    // Session Management
    const currentSessionId = await this.sessionService.getOrCreateSession(
      userId,
      body.sessionId,
      latestMessage,
    );

    // Save User Message
    await this.sessionService.saveMessage(
      currentSessionId,
      'user',
      latestMessage,
    );

    // Set up streaming response headers
    res.setHeader('x-session-id', currentSessionId);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders(); // CRITICAL: Force headers to be sent immediately so the frontend fetch doesn't hang!

    const currentMessages: ModelMessage[] = [
      ...sanitizedMessages,
    ] as ModelMessage[];

    try {
      // Delegate all AI logic to ChatService
      const result = await this.chatService.streamChat(
        userId,
        currentSessionId,
        currentMessages,
        { isNewSession: !body.sessionId, latestMessage },
      );

      // Iterate the stream and write to the HTTP response
      for await (const part of result.fullStream) {
        if (part.type === 'text-delta') {
          res.write(part.text);
        } else if (part.type === 'tool-call') {
          res.write(`\n\n_⚙️ Executing Tool: ${part.toolName}..._\n\n`);
        } else if (part.type === 'error') {
          console.error('AI Stream Error (Part):', part.error);
          const errMsg =
            part.error instanceof Error
              ? part.error.message
              : String(part.error);
          res.write(
            `\n\n**Error:** The AI service encountered an issue. ${errMsg}\n\n`,
          );
        }
      }
    } catch (error: unknown) {
      console.error('AI Stream Error:', error);
      const errMsg = error instanceof Error ? error.message : String(error);
      res.write(
        `\n\n**Error:** The AI service encountered an issue. ${errMsg || 'Please try again later.'}\n\n`,
      );
    } finally {
      res.end();
    }
  }

  @Get('history')
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

    return await this.sessionService.getPaginatedHistory(
      userId,
      pageNum,
      limit,
      sessionId,
    );
  }

  @Get('sessions')
  async getChatSessions(@Req() req: AuthRequest) {
    const userId = req.user.sub;
    const sessions = await this.sessionService.getSessions(userId);
    return { sessions };
  }

  @Patch('sessions/:id')
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
    const history = await this.sessionService.getPaginatedHistory(
      userId,
      1,
      1,
      sessionId,
    );
    if (!history.sessionId) {
      throw new BadRequestException('Session not found or access denied');
    }

    await this.sessionService.renameSession(
      userId,
      sessionId,
      body.title.trim(),
    );
    return { success: true };
  }

  @Delete('sessions/:id')
  async deleteSession(
    @Req() req: AuthRequest,
    @Param() param: ChatSessionParamDto,
  ) {
    const sessionId = param.id;
    const userId = req.user.sub;
    await this.sessionService.deleteSession(userId, sessionId);
    return { success: true };
  }
}
