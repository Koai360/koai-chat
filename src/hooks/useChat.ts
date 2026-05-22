import { useCallback, useEffect, useRef, useState } from "react";
import {
  createConversation,
  deleteConversation as apiDeleteConversation,
  getMessages,
  listConversations,
  streamMessage,
  type StreamEvent,
} from "@/lib/api";
import type { ChatMessage, Conversation, SendMessagePayload, ThinkingLevel } from "@/types/api";

/**
 * useChat — state machine principal del chat con Noa.
 *
 * Maneja:
 *   - Carga inicial de conversaciones
 *   - Selección de conversación activa + load mensajes
 *   - Envío de mensajes con streaming SSE
 *   - Optimistic update del mensaje user + streaming del assistant
 *   - Stop generation con AbortController
 *   - Hint mientras Noa "piensa" (consultando, escribiendo, etc.)
 */
export interface UseChatReturn {
  conversations: Conversation[];
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  messages: ChatMessage[];
  loading: boolean;
  loadingHint: string | null;
  streamingText: string;
  thinkingLevel: ThinkingLevel;
  setThinkingLevel: (lvl: ThinkingLevel) => void;
  sendMessage: (text: string, opts?: Partial<SendMessagePayload>) => Promise<void>;
  stopGeneration: () => void;
  newConversation: () => Promise<Conversation>;
  deleteConversation: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useChat(userId: string | undefined): UseChatReturn {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveIdState] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingHint, setLoadingHint] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState("");
  const [thinkingLevel, setThinkingLevel] = useState<ThinkingLevel>("medium");

  const abortRef = useRef<AbortController | null>(null);
  const activeIdRef = useRef<string | null>(null);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  // Carga inicial de conversaciones
  useEffect(() => {
    if (!userId) return;
    listConversations()
      .then(setConversations)
      .catch((err) => console.warn("[useChat] listConversations failed", err));
  }, [userId]);

  // Cuando cambia activeId, cargar mensajes
  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    setMessages([]);
    getMessages(activeId)
      .then((msgs) => {
        if (activeIdRef.current === activeId) setMessages(msgs);
      })
      .catch((err) => console.warn("[useChat] getMessages failed", err));
  }, [activeId]);

  const setActiveId = useCallback((id: string | null) => {
    setActiveIdState(id);
  }, []);

  const newConversation = useCallback(async (): Promise<Conversation> => {
    const conv = await createConversation("noa");
    setConversations((prev) => [conv, ...prev]);
    setActiveIdState(conv.id);
    return conv;
  }, []);

  const deleteConversation = useCallback(
    async (id: string) => {
      try {
        await apiDeleteConversation(id);
      } catch (err) {
        console.warn("[useChat] delete failed", err);
      }
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeIdRef.current === id) {
        setActiveIdState(null);
        setMessages([]);
      }
    },
    [],
  );

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
    setLoadingHint(null);
  }, []);

  const sendMessage = useCallback(
    async (text: string, opts: Partial<SendMessagePayload> = {}) => {
      if (!text.trim() || loading) return;

      // Garantizar conversación activa
      let convId = activeIdRef.current;
      if (!convId) {
        const conv = await newConversation();
        convId = conv.id;
      }

      // Optimistic user message
      const userMsg: ChatMessage = {
        id: `tmp-${Date.now()}`,
        conversation_id: convId,
        role: "user",
        content: text,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);
      setStreamingText("");
      setLoadingHint("Pensando…");

      const abort = new AbortController();
      abortRef.current = abort;

      const payload: SendMessagePayload = {
        message: text,
        conversation_id: convId,
        agent: "noa",
        thinking_level: thinkingLevel,
        ...opts,
      };

      let accumulated = "";
      let imageUrl: string | null = null;
      try {
        for await (const ev of streamMessage(payload, abort.signal)) {
          handleStreamEvent(ev, {
            onDelta: (delta) => {
              accumulated += delta;
              setStreamingText(accumulated);
              setLoadingHint(null);
            },
            onHint: (hint) => setLoadingHint(hint),
            onImage: (url) => {
              imageUrl = url;
              setLoadingHint(null);
            },
            onDone: () => {
              // Promovemos streamingText → message
              if ((accumulated || imageUrl) && convId) {
                const assistantMsg: ChatMessage = {
                  id: `assistant-${Date.now()}`,
                  conversation_id: convId,
                  role: "assistant",
                  content: accumulated,
                  image: imageUrl,
                  created_at: new Date().toISOString(),
                };
                setMessages((prev) => [...prev, assistantMsg]);
              }
              setStreamingText("");
            },
          });
        }
      } catch (err) {
        if ((err as { name?: string })?.name !== "AbortError") {
          console.error("[useChat] stream error", err);
          const errMsg: ChatMessage = {
            id: `err-${Date.now()}`,
            conversation_id: convId,
            role: "assistant",
            content: `_Error al generar respuesta. Intentá de nuevo._`,
            created_at: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, errMsg]);
        }
      } finally {
        // Si el stream terminó sin enviar `done` (timeout, abort, error), flush manual
        if (accumulated || imageUrl) {
          setMessages((prev) => {
            // Dedup: si onDone ya promovió, no agregar de nuevo
            if (prev.some((m) => m.role === "assistant" && m.content === accumulated && m.image === imageUrl)) {
              return prev;
            }
            return [
              ...prev,
              {
                id: `assistant-${Date.now()}`,
                conversation_id: convId!,
                role: "assistant",
                content: accumulated,
                image: imageUrl,
                created_at: new Date().toISOString(),
              },
            ];
          });
        }
        setStreamingText("");
        setLoading(false);
        setLoadingHint(null);
        abortRef.current = null;
      }
    },
    [loading, thinkingLevel, newConversation, messages],
  );

  const refresh = useCallback(async () => {
    try {
      const list = await listConversations();
      setConversations(list);
    } catch (err) {
      console.warn("[useChat] refresh failed", err);
    }
  }, []);

  return {
    conversations,
    activeId,
    setActiveId,
    messages,
    loading,
    loadingHint,
    streamingText,
    thinkingLevel,
    setThinkingLevel,
    sendMessage,
    stopGeneration,
    newConversation,
    deleteConversation,
    refresh,
  };
}

function handleStreamEvent(
  ev: StreamEvent,
  handlers: {
    onDelta: (text: string) => void;
    onHint: (hint: string) => void;
    onDone: () => void;
    onImage: (url: string) => void;
  },
) {
  const data = ev.data;
  const type = ev.type as string;

  // koai-api emite `event: token` para texto del LLM, `event: image` para imágenes,
  // `event: image_metadata` para metadata, `event: ping` para heartbeat, `event: done`.
  // También aceptamos `delta` (alias generic), `hint` (status), `card` (estructurada).
  switch (type) {
    case "token":
    case "delta": {
      const text =
        typeof data === "string"
          ? data
          : (data as { text?: string; content?: string; delta?: string })?.text ??
            (data as { text?: string; content?: string; delta?: string })?.content ??
            (data as { text?: string; content?: string; delta?: string })?.delta ??
            "";
      if (text) handlers.onDelta(text);
      break;
    }
    case "image": {
      const url =
        typeof data === "string"
          ? data
          : (data as { image?: string; url?: string })?.image ??
            (data as { image?: string; url?: string })?.url ??
            "";
      if (url) handlers.onImage(url);
      break;
    }
    case "image_metadata":
      // Solo log/track — no se renderiza en chat por ahora
      break;
    case "ping":
      // Heartbeat keepalive — ignorar
      break;
    case "hint": {
      const hint =
        typeof data === "string"
          ? data
          : (data as { text?: string; hint?: string })?.text ??
            (data as { text?: string; hint?: string })?.hint ??
            "";
      if (hint) handlers.onHint(hint);
      break;
    }
    case "done":
      handlers.onDone();
      break;
    case "tool_call":
    case "tool_result":
      if (data && typeof data === "object" && "name" in data) {
        const name = String((data as { name: unknown }).name);
        handlers.onHint(`Consultando ${name}…`);
      }
      break;
    case "card":
      if (data && typeof data === "object") {
        const typed = data as { type?: string };
        if (typed.type) {
          const block = `\n\`\`\`card:${typed.type}\n${JSON.stringify(data)}\n\`\`\`\n`;
          handlers.onDelta(block);
        }
      }
      break;
    case "error":
      console.warn("[useChat] backend error event", data);
      break;
    default:
      // Log no-mapeado para diagnosis sin romper el stream
      if (type !== "message") {
        console.debug("[useChat] unmapped event type:", type, data);
      }
      break;
  }
}
