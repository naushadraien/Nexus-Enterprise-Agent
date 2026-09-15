"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown, { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Send,
  User,
  Sparkles,
  Loader2,
  Paperclip,
  LogIn,
  X,
  Plus,
  MessageSquare,
  Pencil,
  Check,
  Trash2,
  Menu,
  AlertTriangle,
} from "lucide-react";
import { selectSingleDocument } from "../utils/file-picker";
import { useAuth, SignInButton, UserButton, useUser } from "@clerk/nextjs";
import { useInfiniteScroll } from "../hooks/use-infinite-scroll";
import { ModeToggle } from "../components/mode-toggle";

// Define the API URL from environment variables
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// Extract markdown components so they aren't recreated on every render tick
/* eslint-disable @typescript-eslint/no-unused-vars */
const markdownComponents: Components = {
  h1: ({ node: _, ...props }) => (
    <h1
      className="text-2xl font-bold mb-3 mt-4 first:mt-0 text-zinc-900 dark:text-zinc-50"
      {...props}
    />
  ),
  h2: ({ node: _, ...props }) => (
    <h2
      className="text-xl font-bold mb-2 mt-4 first:mt-0 text-zinc-900 dark:text-zinc-50"
      {...props}
    />
  ),
  h3: ({ node: _, ...props }) => (
    <h3
      className="text-lg font-bold mb-2 mt-4 first:mt-0 text-zinc-900 dark:text-zinc-50"
      {...props}
    />
  ),
  p: ({ node: _, ...props }) => (
    <p
      className="mb-3 last:mb-0 leading-relaxed text-zinc-800 dark:text-zinc-200"
      {...props}
    />
  ),
  ul: ({ node: _, ...props }) => (
    <ul
      className="list-disc ml-5 mb-3 space-y-1 text-zinc-800 dark:text-zinc-200"
      {...props}
    />
  ),
  ol: ({ node: _, ...props }) => (
    <ol
      className="list-decimal ml-5 mb-3 space-y-1 text-zinc-800 dark:text-zinc-200"
      {...props}
    />
  ),
  li: ({ node: _, ...props }) => <li className="pl-1" {...props} />,
  a: ({ node: _, ...props }) => (
    <a
      className="text-indigo-600 dark:text-indigo-400 hover:underline"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    />
  ),
  strong: ({ node: _, ...props }) => (
    <strong
      className="font-semibold text-zinc-900 dark:text-zinc-50"
      {...props}
    />
  ),
  hr: ({ node: _, ...props }) => (
    <hr className="border-zinc-200 dark:border-zinc-800 my-5" {...props} />
  ),
  code: ({ node: _, className, children, ...props }) => {
    const match = /language-(\w+)/.exec(className || "");
    const isInline = !match && !className?.includes("language-");
    return isInline ? (
      <code
        className="bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 px-1.5 py-0.5 rounded-md text-xs font-mono border border-zinc-200/60 dark:border-zinc-700/60"
        {...props}
      >
        {children}
      </code>
    ) : (
      <div className="my-3 rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 text-xs shadow-xs">
        <div className="flex items-center justify-between px-4 py-2 bg-zinc-950/80 border-b border-zinc-800 text-zinc-400 font-mono text-[11px]">
          <span>{match?.[1] || "code"}</span>
        </div>
        <pre className="p-4 overflow-x-auto font-mono text-zinc-200 leading-relaxed text-xs">
          <code className={className} {...props}>
            {children}
          </code>
        </pre>
      </div>
    );
  },
};
/* eslint-enable @typescript-eslint/no-unused-vars */

const TypewriterMarkdown = ({
  content = "",
  animate = false,
  isStreaming = false,
}: {
  content: string;
  animate?: boolean;
  isStreaming?: boolean;
}) => {
  const [displayedLength, setDisplayedLength] = useState(
    animate ? 0 : content.length,
  );

  useEffect(() => {
    if (!animate) {
      const timer = setTimeout(() => {
        setDisplayedLength(content.length);
      }, 0);
      return () => clearTimeout(timer);
    }

    if (displayedLength < content.length) {
      const remaining = content.length - displayedLength;
      // Smooth adaptive typing: faster for larger chunks, natural character cadence for small
      const step = remaining > 60 ? 5 : remaining > 25 ? 3 : 1;
      const timer = setTimeout(() => {
        setDisplayedLength((prev) => Math.min(prev + step, content.length));
      }, 12);
      return () => clearTimeout(timer);
    }
  }, [content, displayedLength, animate]);

  const displayedText = content.slice(0, displayedLength);

  return (
    <div className="relative">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={markdownComponents}
      >
        {displayedText}
      </ReactMarkdown>
      {(isStreaming || (animate && displayedLength < content.length)) && (
        <span className="inline-block w-1.5 h-4 ml-1 bg-zinc-800 dark:bg-zinc-200 animate-pulse align-middle rounded-xs" />
      )}
    </div>
  );
};

export default function Home() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const activeJobIdRef = useRef<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [sessions, setSessions] = useState<
    { id: string; title: string; createdAt: string }[]
  >([]);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  // URL Sync for Session ID
  useEffect(() => {
    if (typeof window !== "undefined") {
      const timer = setTimeout(() => {
        const urlParams = new URLSearchParams(window.location.search);
        setSessionId(urlParams.get("session") || "new");
        setIsInitializing(false);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    if (sessionId && typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (sessionId !== "new") {
        url.searchParams.set("session", sessionId);
      } else {
        url.searchParams.delete("session");
      }
      window.history.replaceState({}, "", url.toString());
    }
  }, [sessionId]);

  // UI States
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [isDeletingSession, setIsDeletingSession] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchSessions = useCallback(async () => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setIsLoadingSessions(false);
      setSessions([]);
      return;
    }
    try {
      setIsLoadingSessions(true);
      const token = await getToken();
      const res = await fetch(`${API_URL}/api/chat/sessions`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch (error) {
      console.error("Failed to fetch sessions", error);
    } finally {
      setIsLoadingSessions(false);
    }
  }, [isLoaded, isSignedIn, getToken]);

  useEffect(() => {
    // Run asynchronously to avoid synchronous setState cascading render warnings
    const load = async () => {
      await fetchSessions();
    };
    load();
  }, [fetchSessions]);

  const handleNewChat = () => {
    setSessionId("new");
  };

  const handleRename = async (e: React.FormEvent, id: string) => {
    e.preventDefault();
    if (!editingTitle.trim()) {
      setEditingSessionId(null);
      return;
    }
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/api/chat/sessions/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ title: editingTitle }),
      });
      if (res.ok) {
        setEditingSessionId(null);
        fetchSessions();
      }
    } catch (error) {
      console.error("Failed to rename session", error);
    }
  };

  const handleDeleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSessionToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteSession = async () => {
    if (!sessionToDelete) return;
    setIsDeletingSession(true);
    try {
      const token = await getToken();
      const res = await fetch(
        `${API_URL}/api/chat/sessions/${sessionToDelete}`,
        {
          method: "DELETE",
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        },
      );
      if (res.ok) {
        fetchSessions();
        if (sessionId === sessionToDelete) {
          handleNewChat();
        }
      }
    } catch (error) {
      console.error("Failed to delete session", error);
    } finally {
      setIsDeletingSession(false);
      setIsDeleteModalOpen(false);
      setSessionToDelete(null);
    }
  };

  const fetchFunction = async (
    page: number,
    _query: string,
    signal: AbortSignal,
  ) => {
    if (_query === "new") {
      return { data: [], hasMore: false };
    }

    const token = await getToken();
    const sessionQuery = _query ? `&sessionId=${_query}` : "";
    const res = await fetch(
      `${API_URL}/api/chat/history?page=${page}${sessionQuery}`,
      {
        signal,
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      },
    );
    if (!res.ok) throw new Error("Failed to fetch history");
    const json = await res.json();
    return { data: json.data || [], hasMore: json.hasMore };
  };

  type MessageItem = {
    id: string;
    role: string;
    content: string;
    animate?: boolean;
    isStreaming?: boolean;
  };

  const {
    data: messages,
    isLoading: historyLoading,
    hasMore,
    loadMoreRef,
    setData: setMessages,
  } = useInfiniteScroll<MessageItem>({
    fetchFunction,
    searchQuery: sessionId || "",
    enabled: isLoaded && isSignedIn && sessionId !== null,
    debounceMs: 0,
  });

  // messages array contains [newest, ..., oldest]
  // Reversing produces chronological order [oldest, ..., newest] so recent messages appear at bottom
  const chronologicalMessages = [...messages].reverse();

  // Auto-scroll to bottom whenever messages change or loading begins
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Clear state when user logs out
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      setTimeout(() => {
        setMessages([]);
        setSessions([]);
        setSessionId(null);
      }, 0);
    }
  }, [isLoaded, isSignedIn, setMessages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Prepend new messages because messages state stores newest first
    const userMessage: MessageItem = {
      id: crypto.randomUUID(),
      role: "user",
      content: input,
    };
    const newMessages: MessageItem[] = [userMessage, ...messages];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    // AI SDK requires chronological order (oldest first)
    const sdkChronologicalMessages = [...newMessages]
      .reverse()
      .map(({ role, content }) => ({ role, content }));

    let pendingSessionId: string | null = null;

    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          messages: sdkChronologicalMessages,
          sessionId: sessionId === "new" ? undefined : sessionId,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to fetch response");
      }

      const returnedSessionId = res.headers.get("x-session-id");
      if (returnedSessionId && (sessionId === null || sessionId === "new")) {
        pendingSessionId = returnedSessionId;
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream returned");

      const decoder = new TextDecoder();
      const aiMessageId = crypto.randomUUID();
      let aiText = "";

      let isFirstChunk = true;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        if (isFirstChunk) {
          isFirstChunk = false;
          // Add a placeholder message for the assistant with animate: true & isStreaming: true
          setMessages((prev) => [
            {
              id: aiMessageId,
              role: "assistant",
              content: "",
              animate: true,
              isStreaming: true,
            },
            ...prev,
          ]);
          // Turn off bouncing loading spinner since text is now actively streaming
          setLoading(false);
        }

        aiText += decoder.decode(value, { stream: true });

        // Update the message content in real-time
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMessageId
              ? { ...m, content: aiText, isStreaming: true }
              : m,
          ),
        );
      }

      // Stream completed: finalize isStreaming to false
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMessageId ? { ...m, isStreaming: false } : m,
        ),
      );
    } catch (error) {
      console.error("Failed to send message", error);
      setMessages([
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content:
            "Error: Could not connect to the backend. Make sure the NestJS server is running.",
          animate: true,
          isStreaming: false,
        },
        ...newMessages,
      ]);
      setLoading(false);
    } finally {
      if (pendingSessionId) {
        setSessionId(pendingSessionId);
        fetchSessions(); // Refresh sessions list if it was a new chat
      }
    }
  };

  const handleCancelUpload = async () => {
    if (!activeJobId) return;

    try {
      const token = await getToken();
      await fetch(`${API_URL}/api/documents/cancel/${activeJobId}`, {
        method: "DELETE",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      setMessages((prev) => [
        {
          id: crypto.randomUUID(),
          role: "system",
          content: "Upload cancelled by user",
        },
        ...prev,
      ]);
    } catch (error) {
      console.error("Failed to cancel job", error);
    } finally {
      setActiveJobId(null);
      activeJobIdRef.current = null;
      setUploadLoading(false);
    }
  };

  const handleFileUpload = async () => {
    try {
      const selected = await selectSingleDocument();
      if (!selected) return; // user cancelled

      setUploadLoading(true);
      // System message to show upload start
      setMessages((prev) => [
        {
          id: crypto.randomUUID(),
          role: "system",
          content: `Started document ingestion: ${selected.name}...`,
        },
        ...prev,
      ]);

      const formData = new FormData();
      formData.append("file", selected.file);

      const token = await getToken();
      const res = await fetch(`${API_URL}/api/documents`, {
        method: "POST",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Upload failed");
      }

      const data = await res.json();
      const jobId = data.jobId;
      setActiveJobId(jobId);
      activeJobIdRef.current = jobId;

      // Poll for job status
      const pollInterval = setInterval(async () => {
        if (activeJobIdRef.current !== jobId) {
          clearInterval(pollInterval);
          return;
        }

        try {
          const currentToken = await getToken();
          const statusRes = await fetch(
            `${API_URL}/api/documents/status/${jobId}`,
            {
              headers: {
                ...(currentToken
                  ? { Authorization: `Bearer ${currentToken}` }
                  : {}),
              },
            },
          );
          const statusData = await statusRes.json();

          if (statusData.state === "completed") {
            clearInterval(pollInterval);
            setActiveJobId(null);
            activeJobIdRef.current = null;
            setMessages((prev) => [
              {
                id: crypto.randomUUID(),
                role: "system",
                content: `Successfully ingested ${selected.name} (${statusData.result.chunksIngested} chunks)`,
              },
              ...prev,
            ]);
            setUploadLoading(false);
          } else if (statusData.state === "failed") {
            clearInterval(pollInterval);
            setActiveJobId(null);
            activeJobIdRef.current = null;

            // If the failure was due to cancellation, we already handled it in handleCancelUpload
            if (statusData.failedReason === "CANCELLED") return;

            throw new Error(statusData.failedReason || "Job failed");
          } else {
            // Update the UI with progress if desired (progress is in statusData.progress)
          }
        } catch (pollError) {
          clearInterval(pollInterval);
          setActiveJobId(null);
          activeJobIdRef.current = null;
          console.error("Polling error:", pollError);
          setMessages((prev) => [
            {
              id: crypto.randomUUID(),
              role: "system",
              content: `Failed to process ${selected.name}`,
            },
            ...prev,
          ]);
          setUploadLoading(false);
        }
      }, 2000);
    } catch (error) {
      console.error(error);
      setMessages((prev) => [
        {
          id: crypto.randomUUID(),
          role: "system",
          content: "Failed to upload document",
        },
        ...prev,
      ]);
      setUploadLoading(false);
    }
  };

  return (
    <div className="h-[100dvh] overflow-hidden bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 flex flex-col font-sans transition-colors duration-300">
      <div className="w-full h-full flex flex-row relative">
        {/* Mobile Sidebar Backdrop */}
        {isLoaded && isSignedIn && isMobileSidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-zinc-950/40 backdrop-blur-sm md:hidden animate-in fade-in duration-300"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <div
          className={`
          fixed inset-y-0 left-0 z-50 w-72 bg-zinc-50 dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 flex flex-col transition-transform duration-300 ease-out md:static md:translate-x-0 shadow-xl md:shadow-none
          ${!isLoaded || !isSignedIn ? "hidden md:flex" : ""}
          ${isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
        >
          <div className="h-16 px-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-3 shrink-0">
            <button
              onClick={() => {
                handleNewChat();
                setIsMobileSidebarOpen(false);
              }}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-95 ${
                sessionId === "new"
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-md"
                  : "bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              <Plus className="w-4 h-4" />
              New Chat
            </button>
            {/* Mobile Close Button */}
            <button
              onClick={() => setIsMobileSidebarOpen(false)}
              className="md:hidden p-2 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {!isLoaded ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="w-full h-9 bg-zinc-200/70 dark:bg-zinc-800/50 rounded-xl animate-pulse mb-1.5"
                />
              ))
            ) : !isSignedIn ? (
              <div className="px-3 py-8 text-center">
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Sign in to save chats
                </p>
                <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1">
                  Your conversations will be stored here
                </p>
              </div>
            ) : isLoadingSessions ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="w-full h-9 bg-zinc-200/70 dark:bg-zinc-800/50 rounded-xl animate-pulse mb-1.5"
                />
              ))
            ) : sessions.length === 0 ? (
              <div className="px-3 py-8 text-center text-xs text-zinc-400 dark:text-zinc-500">
                No past conversations
              </div>
            ) : (
              sessions.map((s) => (
                <div key={s.id} className="relative group">
                  {editingSessionId === s.id ? (
                    <form
                      onSubmit={(e) => handleRename(e, s.id)}
                      className="flex items-center w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xs"
                    >
                      <input
                        type="text"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        autoFocus
                        onBlur={(e) =>
                          handleRename(e as unknown as React.FormEvent, s.id)
                        }
                        className="bg-transparent text-zinc-900 dark:text-zinc-100 text-xs font-medium w-full focus:outline-none"
                      />
                      <button
                        type="submit"
                        className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 p-1 rounded"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  ) : (
                    <button
                      onClick={() => {
                        setSessionId(s.id);
                        setIsMobileSidebarOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-medium transition-colors flex items-center justify-between group-hover:pr-14 ${
                        sessionId === s.id
                          ? "bg-zinc-200/80 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold"
                          : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-200"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-60" />
                        <span className="truncate block">{s.title}</span>
                      </div>
                    </button>
                  )}
                  {editingSessionId !== s.id && (
                    <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingTitle(s.title);
                          setEditingSessionId(s.id);
                        }}
                        className="p-1 text-zinc-400 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100 rounded-md transition-colors"
                        title="Rename Chat"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => handleDeleteSession(e, s.id)}
                        className="p-1 text-zinc-400 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400 rounded-md transition-colors"
                        title="Delete Chat"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Main Application Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-zinc-950 relative">
          {/* Header */}
          <header className="flex-none h-16 px-4 md:px-8 border-b border-zinc-200/80 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md flex items-center justify-between sticky top-0 z-10">
            <div className="flex items-center gap-3">
              {isLoaded && isSignedIn && (
                <button
                  onClick={() => setIsMobileSidebarOpen(true)}
                  className="md:hidden p-2 -ml-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
                >
                  <Menu className="w-5 h-5" />
                </button>
              )}
              <div className="bg-zinc-900 dark:bg-zinc-100 p-2 rounded-xl shadow-xs">
                <Sparkles className="w-4 h-4 text-white dark:text-zinc-900" />
              </div>
              <div>
                <h1 className="text-sm md:text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                  Nexus
                </h1>
              </div>
            </div>

            {/* Auth Buttons & Theme Toggle */}
            <div className="flex items-center gap-2.5 md:gap-3">
              <ModeToggle />

              {!isLoaded && (
                <div className="w-8 h-8 rounded-full bg-zinc-200/70 dark:bg-zinc-800 animate-pulse" />
              )}
              {isLoaded && !isSignedIn && (
                <SignInButton mode="modal">
                  <button className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95 shadow-xs">
                    <LogIn className="w-3.5 h-3.5" />
                    Sign In
                  </button>
                </SignInButton>
              )}
              {isLoaded && isSignedIn && (
                <UserButton
                  appearance={{ elements: { avatarBox: "w-8 h-8" } }}
                />
              )}
            </div>
          </header>

          {/* Chat Area */}
          <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 scroll-smooth relative z-0">
            <div className="flex flex-col gap-6 w-full min-h-full">
              {/* Infinite Scroll Sentinel (at the TOP for loading older history) */}
              {hasMore && (
                <div
                  ref={loadMoreRef}
                  className="flex justify-center py-2 min-h-[16px]"
                >
                  {historyLoading && messages.length > 0 && (
                    <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                  )}
                </div>
              )}

              {uploadLoading && (
                <div className="flex justify-center my-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-full pl-4 pr-2 py-1.5 flex items-center gap-2 text-xs shadow-xs">
                    <Loader2 size={13} className="animate-spin text-zinc-500" />
                    <span>Processing document...</span>
                    <button
                      onClick={handleCancelUpload}
                      className="ml-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 p-1 rounded-full transition-colors flex items-center justify-center text-zinc-500"
                      title="Cancel Upload"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              )}

              {isInitializing || (historyLoading && messages.length === 0) ? (
                <div className="w-full h-full flex flex-col gap-6 justify-end pb-8 max-w-3xl mx-auto">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div
                      key={i}
                      className={`flex gap-3 md:gap-4 animate-pulse ${i % 2 === 0 ? "flex-row-reverse" : "flex-row"}`}
                    >
                      <div className="w-8 h-8 rounded-xl bg-zinc-200/80 dark:bg-zinc-800 shrink-0" />
                      <div
                        className={`h-16 w-2/3 md:w-1/2 bg-white dark:bg-zinc-900 rounded-2xl ${i % 2 === 0 ? "rounded-tr-xs" : "rounded-tl-xs"} border border-zinc-200/60 dark:border-zinc-800/60`}
                      />
                    </div>
                  ))}
                </div>
              ) : messages.length === 0 ? (
                <div className="w-full max-w-2xl mx-auto my-auto py-12 px-4 flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-500">
                  <div className="w-12 h-12 rounded-2xl bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center shadow-xs mb-4">
                    <Sparkles className="w-6 h-6 text-white dark:text-zinc-900" />
                  </div>
                  <h2 className="text-xl md:text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 mb-2">
                    Nexus
                  </h2>
                  <p className="text-xs md:text-sm text-zinc-500 dark:text-zinc-400 max-w-md mb-8 leading-relaxed">
                    Search company knowledge with RAG, run live tools via MCP,
                    or upload documents to get started.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
                    {[
                      {
                        title: "Knowledge Base",
                        desc: "Search documents",
                        query:
                          "What documents are indexed in the knowledge base?",
                      },
                      {
                        title: "Live Weather",
                        desc: "Test MCP tool",
                        query: "What is the weather in New York?",
                      },
                      {
                        title: "Capabilities",
                        desc: "View all features",
                        query: "What tools and capabilities do you have?",
                      },
                    ].map((chip, idx) => (
                      <button
                        key={idx}
                        onClick={() => setInput(chip.query)}
                        className="text-left p-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-xs transition-all text-xs group"
                      >
                        <span className="font-semibold block text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {chip.title}
                        </span>
                        <span className="text-zinc-500 dark:text-zinc-400 mt-0.5 block text-[11px]">
                          {chip.desc}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {/* Chronological Messages: Oldest at top, most recent at bottom */}
                  {chronologicalMessages.map((m) => {
                    if (m.role === "system") {
                      return (
                        <div
                          key={m.id}
                          className="flex justify-center my-2 animate-in fade-in slide-in-from-bottom-2 duration-300"
                        >
                          <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 rounded-full px-3.5 py-1 flex items-center gap-2 text-xs font-medium shadow-xs">
                            <Paperclip size={12} />
                            <span>{m.content}</span>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={m.id}
                        className={`flex gap-3 md:gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300 ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                      >
                        {/* Avatar */}
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-xs overflow-hidden ${m.role === "user" ? "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300" : "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"}`}
                        >
                          {m.role === "user" ? (
                            user?.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={user.imageUrl}
                                alt="User"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <User size={15} />
                            )
                          ) : (
                            <Sparkles size={15} />
                          )}
                        </div>

                        {/* Message Bubble */}
                        <div
                          className={`max-w-[85%] md:max-w-[78%] rounded-2xl px-5 py-3.5 shadow-xs text-sm md:text-[15px] ${
                            m.role === "user"
                              ? "bg-zinc-100 border border-zinc-200/50 text-zinc-900 dark:bg-zinc-800/80 dark:border-zinc-700/50 dark:text-zinc-100 rounded-tr-xs"
                              : "bg-white dark:bg-zinc-900/50 text-zinc-900 dark:text-zinc-100 rounded-tl-xs border border-zinc-200/80 dark:border-zinc-800/80 overflow-x-auto"
                          }`}
                        >
                          {m.role === "user" ? (
                            <p className="whitespace-pre-wrap leading-relaxed">
                              {m.content}
                            </p>
                          ) : (
                            <div className="leading-relaxed prose prose-zinc dark:prose-invert max-w-none">
                              <TypewriterMarkdown
                                content={m.content}
                                animate={m.animate}
                                isStreaming={m.isStreaming}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* AI Response Loading Bouncing Dots Indicator: positioned below user query at bottom */}
                  {loading && (
                    <div className="flex gap-3 md:gap-4 flex-row animate-in fade-in slide-in-from-bottom-2 duration-300 mb-2">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs">
                        <Sparkles size={15} />
                      </div>
                      <div className="bg-white dark:bg-zinc-900 rounded-2xl rounded-tl-xs px-4 py-3 border border-zinc-200/80 dark:border-zinc-800 flex items-center gap-2 text-zinc-500 dark:text-zinc-400 shadow-xs">
                        <span className="flex gap-1.5">
                          <span
                            className="w-1.5 h-1.5 bg-zinc-400 dark:bg-zinc-500 rounded-full animate-bounce"
                            style={{ animationDelay: "0ms" }}
                          />
                          <span
                            className="w-1.5 h-1.5 bg-zinc-400 dark:bg-zinc-500 rounded-full animate-bounce"
                            style={{ animationDelay: "150ms" }}
                          />
                          <span
                            className="w-1.5 h-1.5 bg-zinc-400 dark:bg-zinc-500 rounded-full animate-bounce"
                            style={{ animationDelay: "300ms" }}
                          />
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Bottom anchor for smooth auto-scrolling */}
                  <div ref={messagesEndRef} className="h-1" />
                </>
              )}
            </div>
          </div>

          {/* Input Area */}
          <div className="flex-none p-4 md:p-6 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl border-t border-zinc-200/80 dark:border-zinc-800 sticky bottom-0 z-10 w-full">
            <div className="w-full">
              {isLoaded && !isSignedIn && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs">
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      Sign in to start chatting
                    </h3>
                    <p className="text-zinc-500 dark:text-zinc-400 text-xs mt-0.5">
                      Authenticate to search private knowledge documents and use
                      AI tools.
                    </p>
                  </div>
                  <SignInButton mode="modal">
                    <button className="w-full sm:w-auto flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 px-5 py-2.5 rounded-xl text-xs font-semibold transition-all shadow-xs active:scale-95 shrink-0">
                      <LogIn className="w-3.5 h-3.5" />
                      Sign In
                    </button>
                  </SignInButton>
                </div>
              )}
              {isLoaded && isSignedIn && (
                <form
                  onSubmit={sendMessage}
                  className="flex gap-2 md:gap-3 items-end"
                >
                  <button
                    type="button"
                    onClick={handleFileUpload}
                    disabled={uploadLoading || loading}
                    className="p-3.5 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 rounded-2xl hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-zinc-200/80 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 flex-none group relative shadow-xs"
                    title="Upload Document"
                  >
                    {uploadLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin text-zinc-900 dark:text-zinc-100" />
                    ) : (
                      <Paperclip className="w-5 h-5 group-hover:scale-105 transition-transform" />
                    )}

                    {/* Tooltip */}
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-2.5 py-1 bg-zinc-900 dark:bg-zinc-100 text-[10px] text-white dark:text-zinc-900 font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-md">
                      Upload Document
                    </div>
                  </button>

                  <div className="flex-1 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 focus-within:border-zinc-400 dark:focus-within:border-zinc-600 focus-within:ring-4 focus-within:ring-zinc-500/10 transition-all overflow-hidden flex shadow-xs">
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Ask the assistant or request a tool..."
                      className="flex-1 bg-transparent px-4 md:px-5 py-3 md:py-3.5 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none text-sm md:text-base w-full"
                      disabled={loading}
                    />
                    <button
                      type="submit"
                      disabled={loading || !input.trim()}
                      className="m-1.5 px-3 py-2 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 disabled:bg-transparent disabled:text-zinc-300 dark:disabled:text-zinc-700 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all flex items-center justify-center disabled:cursor-not-allowed"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
            onClick={() => setIsDeleteModalOpen(false)}
          />
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl p-6 w-full max-w-sm relative z-10 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Delete Chat
              </h3>
            </div>
            <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-6 leading-relaxed">
              Are you sure you want to delete this chat session? This action
              cannot be undone and all messages will be permanently lost.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteSession}
                disabled={isDeletingSession}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors shadow-sm flex items-center gap-2"
              >
                {isDeletingSession ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
