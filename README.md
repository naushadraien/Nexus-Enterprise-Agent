# Nexus: Enterprise Agent (RAG)

Nexus is a full-stack, enterprise-grade AI assistant capable of retrieving internal knowledge (Retrieval-Augmented Generation), querying databases, and executing tools via MCP (Model Context Protocol).

This project uses a monorepo structure powered by **Turborepo** with a **NestJS** backend, a **Next.js** frontend, and a dedicated **MCP Server**.

## 📂 Project Structure

```text
rag-project/
├── apps/
│   ├── backend/        # NestJS API (Core logic, RAG ingestion, AI chat)
│   ├── frontend/       # Next.js App Router UI (Chat interface, auth)
│   └── mcp-server/     # Model Context Protocol server (External tools)
├── turbo.json          # Turborepo configuration
└── package.json        # Root package file
```

## 🏗 Architecture & Tech Stack

### 🔹 Frontend (`apps/frontend`)
- **Framework:** Next.js (App Router), React, Tailwind CSS
- **UI Components:** Shadcn UI, Lucide Icons, `next-themes` (Dark Mode)
- **State/Data:** `@ai-sdk/react` for streaming AI responses
- **Auth:** Clerk (`@clerk/nextjs`)

### 🔹 Backend (`apps/backend`)
- **Framework:** NestJS
- **Database ORM:** Drizzle ORM (PostgreSQL / Neon)
- **AI / LLM:** Google Gemini (`@ai-sdk/google`)
- **Vector Database:** Pinecone (for RAG / Document Embeddings)
- **Job Queue:** BullMQ & Redis (Upstash) for background document ingestion
- **Auth:** Clerk (Backend Verification)

### 🔹 MCP Server (`apps/mcp-server`)
- **Protocol:** Model Context Protocol (MCP) using `@modelcontextprotocol/sdk`
- **Purpose:** Exposes external capabilities (e.g. system commands, APIs) as standardized tools for the AI agent.

## ✨ Features
- **Real-time AI Chat**: Streams responses chunk-by-chunk using Vercel AI SDK.
- **RAG Document Ingestion**: Upload PDFs, TXTs, or Markdown. The files are queued (Redis/BullMQ), parsed, chunked, and stored in Pinecone as vector embeddings.
- **MCP Tool Calling**: The agent can call external local tools via Model Context Protocol.
- **Session Management**: Chat sessions are grouped, saved to a Postgres database, and have auto-generated titles.
- **Authentication**: Fully authenticated with Clerk.

## 🚀 Setup Instructions

### 1. Install Dependencies
Run the following at the root of the project to install all dependencies across all workspaces:
```bash
npm install
```

### 2. Environment Variables
You will need to set up environment variables for the workspaces.

**Backend (`apps/backend/.env`):**
Copy `apps/backend/.env.example` to `apps/backend/.env` and fill in your keys for Google Gemini, Pinecone, Postgres, Redis, and Clerk.

**Frontend (`apps/frontend/.env.local`):**
Copy `apps/frontend/.env.example` to `apps/frontend/.env.local` and fill in your Clerk keys.

### 3. Database Migration
In the backend directory, push the Drizzle schema to your database:
```bash
cd apps/backend
npm run db:generate
npm run db:push
```

### 4. Running the Application
Using Turborepo, you can run all applications concurrently from the root directory:

```bash
npx turbo run dev
```

Alternatively, you can run them individually:
- **Backend:** `cd apps/backend && npm run dev`
- **Frontend:** `cd apps/frontend && npm run dev`
- **MCP Server:** `cd apps/mcp-server && npm run dev`

Navigate to `http://localhost:3000` to interact with the Nexus agent.
