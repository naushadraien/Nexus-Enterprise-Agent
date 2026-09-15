import { Module } from '@nestjs/common';
import { AiProviderService } from './ai.service';

@Module({
  providers: [AiProviderService],
  exports: [AiProviderService],
})
export class AiModule {}
