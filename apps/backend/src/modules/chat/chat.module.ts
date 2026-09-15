import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { RagModule } from '../rag/rag.module';
import { McpModule } from '../mcp/mcp.module';
import { AiModule } from '../ai/ai.module';
import { SessionModule } from '../session/session.module';

@Module({
  imports: [RagModule, McpModule, AiModule, SessionModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
