import { Injectable, Logger } from '@nestjs/common';
import {
  streamText,
  generateText,
  ToolSet,
  isStepCount,
  tool,
  ModelMessage,
} from 'ai';
import { z } from 'zod';
import { google } from '@ai-sdk/google';
import { RagService } from './rag.service';
import { McpClientService } from './mcp-client.service';
import { AppService } from './app.service';

/** Shape of each part emitted by fullStream */
export type StreamPart =
  | { type: 'text-delta'; text: string }
  | { type: 'tool-call'; toolName: string }
  | { type: 'error'; error: unknown }
  | { type: string };

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly ragService: RagService,
    private readonly mcpClientService: McpClientService,
    private readonly appService: AppService,
  ) {}

  /**
   * Build the AI tool definitions, call streamText, and return the full stream result.
   * The controller is responsible for iterating the stream and writing to the HTTP response.
   */
  async streamChat(
    userId: string,
    sessionId: string,
    messages: ModelMessage[],
    options: { isNewSession: boolean; latestMessage: string },
  ) {
    // 1. Fetch MCP Tools from Memory Cache
    const mcpTools = (await this.mcpClientService.getAiSdkTools()) as ToolSet;

    const knowledgeBaseSchema = z.object({
      query: z
        .string()
        .describe('The search query to look up in the knowledge base.'),
    });

    // 2. Define the Agentic RAG Tool
    const ragTool = {
      search_knowledge_base: tool({
        description:
          'Search the internal company knowledge base for documents, policies, or facts. ONLY use this when the user asks a specific question about company data. Do NOT use this for casual conversation or greetings.',
        inputSchema: knowledgeBaseSchema,
        execute: async (args: z.infer<typeof knowledgeBaseSchema>) => {
          const query = args.query;
          this.logger.log(`[RAG Tool] AI is searching for: "${query}"`);
          const results = await this.ragService.retrieveContext(query, userId);
          return results.length > 0
            ? results.join('\n\n')
            : 'No relevant information found in the knowledge base.';
        },
      }),
    };

    // 3. Combine MCP tools and Native tools
    const combinedTools: ToolSet = {
      ...mcpTools,
      ...ragTool,
    };

    // 4. Call streamText and return the result for the controller to iterate
    const result = streamText({
      model: google('gemini-3.6-flash'),
      maxRetries: 0, // Prevent 45-second silent hangs when API quota is hit
      system: `You are a helpful company assistant. You can use available tools to look up external information or search the internal company knowledge base. Always use tools when you need to verify facts, but DO NOT use tools for casual greetings or conversational replies. Do NOT introduce yourself as an AI built by Google, and do not use repetitive generic greetings. Provide direct, natural responses without preamble.`,
      messages,
      tools: combinedTools,
      stopWhen: isStepCount(5), // Automatically loops for tool calls!
      onFinish: async ({ text }) => {
        // Save Assistant Message
        await this.appService.saveMessage(sessionId, 'assistant', text || '');

        // Background Task: Auto-generate title for new sessions
        if (options.isNewSession) {
          this.generateTitle(
            userId,
            sessionId,
            options.latestMessage,
            text || '',
          ).catch((e) =>
            this.logger.error('Background title generation failed', e),
          );
        }
      },
    });

    return result;
  }

  /**
   * Generate a concise 2-5 word title for a chat session and save it.
   */
  async generateTitle(
    userId: string,
    sessionId: string,
    userMessage: string,
    assistantMessage: string,
  ) {
    try {
      const summaryResult = await generateText({
        model: google('gemini-3.6-flash'),
        system:
          'You are a helpful assistant that generates a concise, 2-5 word title for a chat session based on the first interaction. Do not use quotes or prefixes like "Title:".',
        prompt: `User: ${userMessage}\nAssistant: ${assistantMessage}`,
      });

      const title = summaryResult.text.trim().replace(/^["']|["']$/g, '');
      if (title) {
        await this.appService.renameSession(userId, sessionId, title);
      }
    } catch (e) {
      this.logger.error('Failed to generate session title:', e);
    }
  }
}
