import { Module } from '@nestjs/common';
import { DocumentService } from './document.service';
import { RagService } from './rag.service';
import { RagProcessor } from './rag.processor';
import { DocumentController } from './document.controller';
import { AiModule } from '../ai/ai.module';
import { BullModule } from '@nestjs/bullmq';
import { RAG_QUEUE_NAME } from '../../constants/constants';

@Module({
  imports: [
    AiModule,
    BullModule.registerQueue({
      name: RAG_QUEUE_NAME,
    }),
  ],
  controllers: [DocumentController],
  providers: [DocumentService, RagService, RagProcessor],
  exports: [RagService],
})
export class RagModule {}
