# Nexus MCP Server

This is a Model Context Protocol (MCP) server for the Nexus Enterprise Agent. It acts as an external bridge, allowing the AI agent (running in the main backend) to interact with local systems, file systems, internal APIs, and other system-level tools.

## 📂 Architecture

The MCP Server is a lightweight standalone application built using the official `@modelcontextprotocol/sdk`. 

- **Server-Sent Events (SSE)**: The server exposes an HTTP transport layer using SSE. The main Nexus NestJS backend connects to this server as a client.
- **Tool Definitions**: All custom tools and system scripts are registered here. The client fetches these definitions over the protocol and integrates them natively into the Vercel AI SDK execution flow.

## 🚀 Setup Instructions

1. **Install Dependencies**
   If you haven't run install at the root, do it here:
   ```bash
   npm install
   ```

2. **Running the Server**
   ```bash
   # Development
   npm run dev

   # Production
   npm run build
   npm start
   ```

   By default, the server runs on **Port 3002** (or your specified port). 

3. **Backend Integration**
   Ensure the NestJS backend has the `MCP_SERVER_URL` configured in its `.env` to point to this server (e.g., `http://localhost:3002/sse`).

## 🛠 Tech Stack

- **Protocol Layer:** `@modelcontextprotocol/sdk` (Express/SSE Transport)
- **Framework:** Express (for HTTP endpoints)
- **Language:** TypeScript
