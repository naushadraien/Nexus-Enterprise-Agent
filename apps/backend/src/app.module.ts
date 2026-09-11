import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { HealthController } from './health.controller';
import { AppService } from './app.service';
import { RagService } from './rag.service';
import { McpClientService } from './mcp-client.service';
import { ConfigModule } from '@nestjs/config';
import { DbModule } from './db/db.module';
import { BullModule } from '@nestjs/bullmq';
import { RagProcessor } from './rag.processor';
import { RAG_QUEUE_NAME } from './constants';

@Module({
  imports: [
    ConfigModule.forRoot(),
    DbModule,
    BullModule.forRoot({
      connection: {
        url: process.env.REDIS_URL,
      },
    }),
    BullModule.registerQueue({
      name: RAG_QUEUE_NAME,
    }),
  ], // Enables .env file parsing, DB, and Redis Queue
  controllers: [HealthController, AppController],
  providers: [AppService, RagService, McpClientService, RagProcessor],
})
export class AppModule {}
