import { Module } from '@nestjs/common';
import { McpClientService } from './mcp.service';

@Module({
  providers: [McpClientService],
  exports: [McpClientService],
})
export class McpModule {}
