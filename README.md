# Nexus: Enterprise Agent (RAG)

Nexus is a full-stack, enterprise-grade AI assistant capable of retrieving internal knowledge (Retrieval-Augmented Generation), querying databases, and executing tools via MCP (Model Context Protocol).

This project uses a monorepo structure with a **NestJS** backend and a **Next.js** frontend.

## Architecture & Tech Stack

### 🔹 Frontend (`apps/frontend`)
- **Framework:** Next.js (App Router), React, Tailwind CSS
- **UI Components:** Shadcn UI, Lucide Icons, `next-themes` (Dark Mode)
- **State/Data:** `@ai-sdk/react` for streaming AI responses
- **Auth:** Clerk (`@clerk/nextjs`)

### 🔹 Backend (`apps/backend`)
- **Framework:** NestJS
- **Database ORM:** Prisma (PostgreSQL / Neon)
- **AI / LLM:** Google Gemini (`@ai-sdk/google`)
- **Vector Database:** Pinecone (for RAG / Document Embeddings)
- **Job Queue:** BullMQ & Redis (Upstash) for background document ingestion
- **Auth:** Clerk (Backend Verification)

## Features
- **Real-time AI Chat**: Streams responses chunk-by-chunk using Vercel AI SDK.
- **RAG Document Ingestion**: Upload PDFs, TXTs, or Markdown. The files are queued (Redis/BullMQ), parsed, chunked, and stored in Pinecone as vector embeddings.
- **MCP Tool Calling**: The agent can call external local tools via Model Context Protocol.
- **Session Management**: Chat sessions are grouped, saved to a Postgres database, and have auto-generated titles.
- **Authentication**: Fully authenticated with Clerk.

## Setup Instructions

### 1. Install Dependencies
Run the following at the root of the project to install all dependencies for both apps:
```bash
npm install
```

### 2. Environment Variables
You will need to set up environment variables for both the backend and frontend.

**Backend (`apps/backend/.env`):**
Copy `apps/backend/.env.example` to `apps/backend/.env` and fill in your keys for Google Gemini, Pinecone, Postgres, Redis, and Clerk.

**Frontend (`apps/frontend/.env.local`):**
Copy `apps/frontend/.env.example` to `apps/frontend/.env.local` and fill in your Clerk keys.

### 3. Database Migration
In the backend directory, push the Prisma schema to your database:
```bash
cd apps/backend
npx prisma db push
npx prisma generate
```

### 4. Running the Application

You can run both apps concurrently from the root directory if you have a concurrently script set up, or run them in separate terminals:

**Start Backend (Port 3001):**
```bash
cd apps/backend
npm run start:dev
```

**Start Frontend (Port 3000):**
```bash
cd apps/frontend
npm run dev
```

Navigate to `http://localhost:3000` to interact with the Nexus agent.
