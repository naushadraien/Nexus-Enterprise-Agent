import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { registerDatabaseTools } from "./tools/database.js";
import { registerWeatherTool } from "./tools/weather.js";

// Create the MCP server using the modern McpServer class
const server = new McpServer({
  name: "rag-project-mcp",
  version: "1.0.0",
});

// Register modular tools
registerWeatherTool(server);
registerDatabaseTools(server);

// Start the server using stdio transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP Server running on stdio"); // Logging must be to stderr for stdio transport
}

main().catch((error) => {
  console.error("Fatal error running MCP server:", error);
  process.exit(1);
});
