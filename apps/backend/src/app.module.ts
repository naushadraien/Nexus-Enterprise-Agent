import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DbModule } from './db/db.module';
import { BullModule } from '@nestjs/bullmq';
import { validate } from './validation/env.validation';

// Feature Modules
import { HealthModule } from './modules/health/health.module';
import { AiModule } from './modules/ai/ai.module';
import { SessionModule } from './modules/session/session.module';
import { McpModule } from './modules/mcp/mcp.module';
import { RagModule } from './modules/rag/rag.module';
import { ChatModule } from './modules/chat/chat.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      validate,
      isGlobal: true, // Make sure it's global
    }),
    DbModule,
    BullModule.forRoot({
      connection: {
        url: process.env.REDIS_URL,
      },
    }),
    HealthModule,
    AiModule,
    SessionModule,
    McpModule,
    RagModule,
    ChatModule,
  ],
})
export class AppModule {}
