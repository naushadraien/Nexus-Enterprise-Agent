# Nexus Backend (NestJS API)

This is the backend service for the Nexus Enterprise Agent. It acts as the core orchestrator, managing AI interactions, document ingestion for Retrieval-Augmented Generation (RAG), and Model Context Protocol (MCP) tool executions.

## 📂 Architecture

The backend is built with **NestJS** and relies on several dedicated services:

- **`ChatService`**: Orchestrates the Vercel AI SDK (`streamText`, `generateText`), constructs the toolset, and handles session title generation.
- **`DocumentService`**: Handles PDF parsing, background job queuing (BullMQ), and status polling for document ingestion.
- **`RagService`**: Manages the Pinecone vector database and Google Gemini embeddings.
- **`McpClientService`**: Connects to the local MCP server via Server-Sent Events (SSE) and exposes external tools to the AI.
- **`AppService`**: Manages PostgreSQL database interactions via Drizzle ORM (Sessions, Messages, Users).

## 🚀 Setup Instructions

1. **Environment Setup**
   Copy `.env.example` (or create a `.env`) with the necessary keys:
   ```env
   # Database & Redis
   DATABASE_URL="postgres://..."
   REDIS_URL="redis://..."

   # AI & Vector DB
   GOOGLE_GENERATIVE_AI_API_KEY="..."
   PINECONE_API_KEY="..."
   PINECONE_INDEX="nexus-index"

   # Auth
   CLERK_SECRET_KEY="..."
   ```

2. **Database Migration**
   Apply the Drizzle schema to your database:
   ```bash
   npm run db:generate
   npm run db:push
   ```

3. **Running the App**
   ```bash
   # development
   npm run start:dev

   # production mode
   npm run build
   npm run start:prod
   ```

## 🛠 Tech Stack

- **Framework:** NestJS
- **ORM:** Drizzle ORM (PostgreSQL)
- **AI/SDKs:** Vercel AI SDK (`ai`, `@ai-sdk/google`), `@modelcontextprotocol/sdk`
- **Vector Search:** Pinecone (`@pinecone-database/pinecone`)
- **Queue/Workers:** BullMQ (`@nestjs/bullmq`), Redis
- **Auth:** Clerk SDK
