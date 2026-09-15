# Nexus Frontend (Next.js UI)

This is the frontend user interface for the Nexus Enterprise Agent. It provides a real-time, interactive chat experience, document management capabilities, and session history handling.

## 📂 Architecture

The frontend is built with **Next.js (App Router)** and designed with modern aesthetic principles:

- **Chat Interface**: Powered by the Vercel AI SDK (`useChat`), allowing seamless streaming of AI responses, including tool call visualization.
- **Component Library**: Utilizing **Shadcn UI** components (Tailwind CSS, Radix UI) for a highly customizable and accessible design system.
- **Styling**: Tailwind CSS and `next-themes` to support dynamic light and dark modes.
- **State Management**: React Hooks integrated tightly with the AI SDK for optimistic UI updates.
- **Auth Layer**: Secured with **Clerk** (`@clerk/nextjs`).

## 🚀 Setup Instructions

1. **Environment Setup**
   Copy `.env.example` to `.env.local` and add your Clerk API keys:
   ```env
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="..."
   CLERK_SECRET_KEY="..."
   ```

2. **Running the App**
   Start the Next.js development server:
   ```bash
   npm run dev
   ```
   The application will be available at [http://localhost:3000](http://localhost:3000).

3. **Building for Production**
   ```bash
   npm run build
   npm run start
   ```

## 🛠 Tech Stack

- **Framework:** Next.js (App Router)
- **UI & Styling:** Tailwind CSS, Shadcn UI, Lucide Icons, `next-themes`
- **AI SDK:** Vercel AI SDK (`@ai-sdk/react`)
- **Authentication:** Clerk
- **Language:** TypeScript
