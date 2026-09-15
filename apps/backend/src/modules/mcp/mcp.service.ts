import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { createMCPClient, MCPClient } from '@ai-sdk/mcp';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import * as path from 'path';

@Injectable()
export class McpClientService implements OnModuleInit, OnModuleDestroy {
  private client: MCPClient;
  private cachedTools: any = null;

  async onModuleInit() {
    console.log('Initializing MCP Client via @ai-sdk/mcp...');

    // Path to the MCP server script
    const serverPath = path.resolve(
      process.cwd(),
      '../mcp-server/src/index.ts',
    );

    const transport = new StdioClientTransport({
      command: 'npx',
      args: ['tsx', serverPath],
    });

    // createMCPClient automatically connects and wraps the transport natively for AI SDK
    this.client = await createMCPClient({
      transport,
    });

    // Cache the tools immediately upon connection
    this.cachedTools = await this.client.tools();

    console.log('MCP Client connected successfully and tools cached!');
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.close();
    }
  }

  /**
   * Returns natively mapped tools for Vercel AI SDK from the cache.
   */
  async getAiSdkTools(): Promise<unknown> {
    if (!this.cachedTools) {
      this.cachedTools = await this.client.tools();
    }
    return this.cachedTools;
  }
}
