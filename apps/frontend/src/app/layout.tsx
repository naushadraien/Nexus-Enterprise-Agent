import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "../components/theme-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Nexus | Enterprise RAG Assistant",
  description:
    "An intelligent, AI-powered enterprise assistant utilizing Retrieval-Augmented Generation (RAG) and Model Context Protocol (MCP) to help you search company knowledge bases, execute live tools, and manage data efficiently.",
  keywords: [
    "Nexus",
    "AI Assistant",
    "RAG",
    "Enterprise Search",
    "LLM",
    "Knowledge Base",
  ],
  authors: [{ name: "Nexus Team" }],
  openGraph: {
    title: "Nexus | Enterprise RAG Assistant",
    description:
      "Search documents, run live MCP tools, and boost your productivity with Nexus.",
    type: "website",
    siteName: "Nexus",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
        suppressHydrationWarning
      >
        <body className="min-h-full flex flex-col">
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {children}
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
