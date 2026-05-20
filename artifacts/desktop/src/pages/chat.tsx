import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Plus, Trash2, MessageSquare, Bot, User, Loader2, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  useListChatSessions,
  getListChatSessionsQueryKey,
  useGetChatSession,
  getGetChatSessionQueryKey,
  useCreateChatSession,
  useDeleteChatSession,
  useSendChatMessage,
  getGetRecentChatsQueryKey,
} from "@workspace/api-client-react";
import type { ChatMessage, AiAction } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

function ActionCard({ action }: { action: AiAction }) {
  const [confirmed, setConfirmed] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="mt-3 rounded-xl border border-primary/30 bg-primary/5 p-3"
    >
      <div className="flex items-start gap-2">
        <AlertCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-primary mb-1">Action Required</p>
          <p className="text-xs text-muted-foreground">{action.description}</p>
        </div>
      </div>
      {!confirmed && (
        <div className="flex gap-2 mt-3">
          <Button
            size="sm"
            className="h-7 text-xs bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30"
            onClick={() => setConfirmed(true)}
            data-testid="button-confirm-action"
          >
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Confirm
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setDismissed(true)}
            data-testid="button-dismiss-action"
          >
            <XCircle className="w-3 h-3 mr-1" />
            Cancel
          </Button>
        </div>
      )}
      {confirmed && (
        <div className="flex items-center gap-1 mt-2 text-xs text-green-400">
          <CheckCircle2 className="w-3 h-3" />
          Confirmed — action queued
        </div>
      )}
    </motion.div>
  );
}

function MessageBubble({ msg, isLast }: { msg: ChatMessage; isLast: boolean }) {
  const isUser = msg.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn("flex gap-3 mb-4", isUser ? "flex-row-reverse" : "flex-row")}
    >
      <div className={cn(
        "w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5",
        isUser ? "bg-primary/20 border border-primary/30" : "bg-white/5 border border-white/10"
      )}>
        {isUser ? <User className="w-3.5 h-3.5 text-primary" /> : <Bot className="w-3.5 h-3.5 text-muted-foreground" />}
      </div>

      <div className={cn("max-w-[75%] min-w-0", isUser ? "items-end" : "items-start")}>
        <div className={cn(
          "px-4 py-2.5 rounded-2xl text-sm leading-relaxed",
          isUser
            ? "bg-primary/15 border border-primary/25 text-foreground rounded-tr-sm"
            : "glass-card text-foreground rounded-tl-sm"
        )}>
          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
        </div>

        {msg.actionType && msg.actionData && (
          <ActionCard action={{
            type: msg.actionType as AiAction["type"],
            description: (() => {
              try { return (JSON.parse(msg.actionData) as { description?: string }).description || "File operation pending"; } catch { return "File operation pending"; }
            })(),
            payload: msg.actionData,
            requiresConfirmation: true,
          }} />
        )}

        <p className="text-[10px] text-muted-foreground/50 mt-1 px-1">
          {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </motion.div>
  );
}

export default function Chat() {
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: sessions = [], isLoading: sessionsLoading } = useListChatSessions({
    query: { queryKey: getListChatSessionsQueryKey() },
  });

  const { data: activeSession, isLoading: messagesLoading } = useGetChatSession(
    activeSessionId ?? 0,
    { query: { enabled: !!activeSessionId, queryKey: getGetChatSessionQueryKey(activeSessionId ?? 0) } }
  );

  const createSession = useCreateChatSession();
  const deleteSession = useDeleteChatSession();
  const sendMessage = useSendChatMessage();

  useEffect(() => {
    if (!activeSessionId && sessions.length > 0) {
      setActiveSessionId(sessions[0].id);
    }
  }, [sessions, activeSessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeSession?.messages?.length]);

  const handleNewSession = useCallback(async () => {
    createSession.mutate(
      { data: { title: "New Chat" } },
      {
        onSuccess: (session) => {
          queryClient.invalidateQueries({ queryKey: getListChatSessionsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetRecentChatsQueryKey() });
          setActiveSessionId(session.id);
        },
      }
    );
  }, [createSession, queryClient]);

  const handleDeleteSession = useCallback((id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteSession.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListChatSessionsQueryKey() });
          if (activeSessionId === id) {
            const remaining = sessions.filter(s => s.id !== id);
            setActiveSessionId(remaining[0]?.id ?? null);
          }
        },
      }
    );
  }, [deleteSession, queryClient, activeSessionId, sessions]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || sendMessage.isPending) return;
    if (!activeSessionId) {
      createSession.mutate(
        { data: { title: input.slice(0, 60) } },
        {
          onSuccess: (session) => {
            queryClient.invalidateQueries({ queryKey: getListChatSessionsQueryKey() });
            setActiveSessionId(session.id);
            setTimeout(() => doSend(session.id), 100);
          },
        }
      );
      return;
    }
    doSend(activeSessionId);
  }, [input, sendMessage.isPending, activeSessionId, createSession, queryClient]);

  const doSend = useCallback((sessionId: number) => {
    const content = input.trim();
    setInput("");
    sendMessage.mutate(
      { id: sessionId, data: { content } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetChatSessionQueryKey(sessionId) });
          queryClient.invalidateQueries({ queryKey: getListChatSessionsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetRecentChatsQueryKey() });
        },
        onError: () => {
          toast({ title: "Failed to send message", variant: "destructive" });
          setInput(content);
        },
      }
    );
  }, [input, sendMessage, queryClient, toast]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const messages = activeSession?.messages ?? [];

  return (
    <div className="flex h-full">
      {/* Session sidebar */}
      <div className="w-52 shrink-0 border-r border-white/10 flex flex-col">
        <div className="p-3 border-b border-white/10 flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sessions</span>
          <Button
            size="icon"
            variant="ghost"
            className="w-6 h-6 hover:bg-white/10"
            onClick={handleNewSession}
            disabled={createSession.isPending}
            data-testid="button-new-session"
          >
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {sessionsLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full rounded-lg bg-white/5" />
              ))
            ) : sessions.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8 px-3">No sessions yet. Start a new chat.</p>
            ) : (
              sessions.map((session) => (
                <motion.div
                  key={session.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={cn(
                    "group flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-all duration-150",
                    activeSessionId === session.id
                      ? "bg-primary/15 border border-primary/20"
                      : "hover:bg-white/5"
                  )}
                  onClick={() => setActiveSessionId(session.id)}
                  data-testid={`session-item-${session.id}`}
                >
                  <MessageSquare className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs text-foreground/80 flex-1 truncate">{session.title}</span>
                  <button
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => handleDeleteSession(session.id, e)}
                    data-testid={`button-delete-session-${session.id}`}
                  >
                    <Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive transition-colors" />
                  </button>
                </motion.div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
          <Bot className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">
            {activeSession?.title || "Select a session"}
          </span>
          {sendMessage.isPending && (
            <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" />
              Thinking...
            </div>
          )}
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 px-4 py-4">
          {!activeSessionId ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Bot className="w-8 h-8 text-primary" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">No active session</p>
                <p className="text-xs text-muted-foreground mt-1">Create a new chat to get started</p>
              </div>
              <Button
                size="sm"
                onClick={handleNewSession}
                className="bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30"
                data-testid="button-start-chat"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Start Chat
              </Button>
            </div>
          ) : messagesLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className={cn("flex gap-3", i % 2 === 0 ? "" : "flex-row-reverse")}>
                  <Skeleton className="w-7 h-7 rounded-full bg-white/5 shrink-0" />
                  <Skeleton className={cn("h-12 rounded-2xl bg-white/5", i % 2 === 0 ? "w-3/4" : "w-1/2")} />
                </div>
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-primary/60" />
              </div>
              <p className="text-sm text-muted-foreground">Ask AXIOM to do something...</p>
              <div className="flex flex-wrap gap-2 justify-center max-w-xs">
                {["Clean up my Downloads", "Organize my Desktop by type", "Find large files"].map(s => (
                  <button
                    key={s}
                    className="text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-muted-foreground hover:text-foreground transition-all"
                    onClick={() => setInput(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-0">
              <AnimatePresence initial={false}>
                {messages.map((msg, i) => (
                  <MessageBubble key={msg.id} msg={msg} isLast={i === messages.length - 1} />
                ))}
              </AnimatePresence>
              {sendMessage.isPending && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-3 mb-4"
                >
                  <div className="w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mt-0.5">
                    <Bot className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                  <div className="glass-card px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </motion.div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </ScrollArea>

        {/* Input */}
        <div className="p-3 border-t border-white/10">
          <div className="flex gap-2 items-end">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask AXIOM to organize files, run a task, or answer a question..."
              className="min-h-[44px] max-h-[120px] resize-none glass-input rounded-xl text-sm py-2.5 flex-1"
              rows={1}
              disabled={sendMessage.isPending}
              data-testid="input-chat-message"
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!input.trim() || sendMessage.isPending}
              className="h-10 w-10 shrink-0 rounded-xl bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 disabled:opacity-40"
              data-testid="button-send-message"
            >
              {sendMessage.isPending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Send className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground/40 mt-1.5 px-1">Enter to send · Shift+Enter for new line</p>
        </div>
      </div>
    </div>
  );
}
