# Nexus Backend (NestJS API)

This is the backend service for the Nexus Enterprise Agent. It acts as the core orchestrator, managing AI interactions, document ingestion for Retrieval-Augmented Generation (RAG), and Model Context Protocol (MCP) tool executions.

## 📂 Architecture

The backend is built with **NestJS** using a modular, domain-driven structure:

- **`AiModule`**: Manages the `AiProviderService` for seamless integration across multiple AI models (OpenAI, Anthropic, Google Gemini, DeepSeek, OpenRouter) and separate text embedding models.
- **`ChatModule`**: Orchestrates the Vercel AI SDK (`streamText`, `generateText`), constructs the MCP toolset, and manages chat interactions.
- **`SessionModule`**: Manages PostgreSQL database interactions via Drizzle ORM (Sessions, Messages, Users) and handles auto-generating chat titles.
- **`RagModule`**: Handles file parsing, background job queuing (BullMQ) for document ingestion, and manages the Pinecone vector database.
- **`McpModule`**: Connects to the local MCP server via Server-Sent Events (SSE) and exposes external tools to the AI.
- **`HealthModule`**: Provides readiness and health checks.

## 🤖 Model-Agnostic AI

The Nexus backend is entirely model-agnostic. Instead of hardcoding a specific AI provider, the backend dynamically instantiates the correct model based on your `.env` configuration. 

You can mix and match providers for chat and text embeddings:
- **Supported Chat Providers:** OpenAI, Anthropic, Google Gemini, DeepSeek, OpenRouter
- **Supported Embedding Providers:** OpenAI, Google Gemini

Example configuration in `.env`:
```env
# Chat Provider
AI_PROVIDER="openrouter"
AI_MODEL_ID="anthropic/claude-3.5-sonnet"
GENERATIVE_AI_API_KEY="your-openrouter-key"

# Embedding Provider
AI_EMBEDDING_PROVIDER="openai"
AI_EMBEDDING_MODEL_ID="text-embedding-3-small"
EMBEDDING_AI_API_KEY="your-openai-key"
```

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
