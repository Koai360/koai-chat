import { useState, useCallback, useEffect } from "react";
import { sendKiraMessage, streamKronosMessage } from "../lib/api";

export type Agent = "kira" | "kronos";

export interface Message {
  id: string;
  role: "user" | "assistant";
  agent: Agent;
  content: string;
  timestamp: number;
}

export interface Conversation {
  id: string;
  agent: Agent;
  messages: Message[];
  createdAt: number;
  title: string;
}

function storageKey(userId: string | null): string {
  return userId ? `koai-chat-conversations-${userId}` : "koai-chat-conversations";
}

function loadConversations(userId: string | null): Conversation[] {
  try {
    return JSON.parse(localStorage.getItem(storageKey(userId)) || "[]");
  } catch {
    return [];
  }
}

function saveConversations(convos: Conversation[], userId: string | null) {
  localStorage.setItem(storageKey(userId), JSON.stringify(convos));
}

function generateTitle(msg: string): string {
  return msg.length > 40 ? msg.slice(0, 40) + "..." : msg;
}

export function useChat(userId: string | null = null) {
  const [conversations, setConversations] = useState<Conversation[]>(() => loadConversations(userId));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [agent, setAgent] = useState<Agent>("kira");
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const active = conversations.find((c) => c.id === activeId) || null;

  // Recargar cuando cambia userId
  useEffect(() => {
    setConversations(loadConversations(userId));
    setActiveId(null);
  }, [userId]);

  const updateConversation = useCallback(
    (id: string, updater: (c: Conversation) => Conversation) => {
      setConversations((prev) => {
        const updated = prev.map((c) => (c.id === id ? updater(c) : c));
        saveConversations(updated, userId);
        return updated;
      });
    },
    [userId],
  );

  const newConversation = useCallback(() => {
    const id = crypto.randomUUID();
    const convo: Conversation = {
      id,
      agent,
      messages: [],
      createdAt: Date.now(),
      title: "Nueva conversación",
    };
    setConversations((prev) => {
      const updated = [convo, ...prev];
      saveConversations(updated, userId);
      return updated;
    });
    setActiveId(id);
    return id;
  }, [agent, userId]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || loading) return;

      let convoId = activeId;
      if (!convoId) {
        convoId = newConversation();
      }

      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        agent,
        content: text.trim(),
        timestamp: Date.now(),
      };

      // Update title if first message
      updateConversation(convoId, (c) => ({
        ...c,
        agent,
        title: c.messages.length === 0 ? generateTitle(text.trim()) : c.title,
        messages: [...c.messages, userMsg],
      }));

      setLoading(true);
      setStreamingText("");

      try {
        if (agent === "kira") {
          const res = await sendKiraMessage(text.trim(), convoId);
          const assistantMsg: Message = {
            id: crypto.randomUUID(),
            role: "assistant",
            agent: "kira",
            content: res.messages?.[0]?.content || "Sin respuesta",
            timestamp: Date.now(),
          };
          updateConversation(convoId, (c) => ({
            ...c,
            messages: [...c.messages, assistantMsg],
          }));
        } else {
          // Kronos — streaming
          const history = conversations
            .find((c) => c.id === convoId)
            ?.messages.map((m) => ({
              role: m.role === "user" ? "user" as const : "assistant" as const,
              content: m.content,
            })) || [];

          const fullText = await streamKronosMessage(
            text.trim(),
            history,
            convoId,
            (partial) => setStreamingText(partial),
          );

          const assistantMsg: Message = {
            id: crypto.randomUUID(),
            role: "assistant",
            agent: "kronos",
            content: fullText || "Sin respuesta",
            timestamp: Date.now(),
          };
          updateConversation(convoId, (c) => ({
            ...c,
            messages: [...c.messages, assistantMsg],
          }));
          setStreamingText("");
        }
      } catch (err) {
        const errorMsg: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          agent,
          content: `Error: ${err instanceof Error ? err.message : "desconocido"}`,
          timestamp: Date.now(),
        };
        updateConversation(convoId, (c) => ({
          ...c,
          messages: [...c.messages, errorMsg],
        }));
        setStreamingText("");
      } finally {
        setLoading(false);
      }
    },
    [activeId, agent, loading, conversations, newConversation, updateConversation],
  );

  const deleteConversation = useCallback((id: string) => {
    setConversations((prev) => {
      const updated = prev.filter((c) => c.id !== id);
      saveConversations(updated, userId);
      return updated;
    });
    if (activeId === id) setActiveId(null);
  }, [activeId, userId]);

  return {
    conversations,
    active,
    activeId,
    setActiveId,
    agent,
    setAgent,
    loading,
    streamingText,
    sendMessage,
    newConversation,
    deleteConversation,
  };
}
