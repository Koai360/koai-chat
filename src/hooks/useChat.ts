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
import { resolveThinkingLevel, type ModelMode } from "@/lib/autoThinking";

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
  modelMode: ModelMode;
  setModelMode: (mode: ModelMode) => void;
  sendMessage: (text: string, opts?: Partial<SendMessagePayload>) => Promise<void>;
  stopGeneration: () => void;
  newConversation: () => Promise<Conversation>;
  deleteConversation: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export interface UseChatOptions {
  userId: string | undefined;
  /**
   * Invocado cuando sendMessage crea una conversación nueva (porque no había
   * activa). El consumer típicamente hace `navigate({ kind: "chat", conversationId })`
   * para sincronizar el URL hash. Se llama DESPUÉS de setActive + setMessages
   * optimistas + skipNextLoadRef, así el useEffect del activeId skipea el load.
   */
  onConversationCreated?: (id: string) => void;
}

const MODEL_MODE_KEY = "noa.modelMode";

function loadInitialMode(): ModelMode {
  try {
    const saved = localStorage.getItem(MODEL_MODE_KEY);
    if (saved === "standard" || saved === "pro") return saved;
    // Migración: usuarios viejos con "auto" guardado → standard
  } catch {
    /* noop */
  }
  return "standard";
}

export function useChat(options: UseChatOptions): UseChatReturn {
  const { userId, onConversationCreated } = options;
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveIdState] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingHint, setLoadingHint] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState("");
  const [modelMode, setModelModeState] = useState<ModelMode>(loadInitialMode);

  const setModelMode = useCallback((mode: ModelMode) => {
    setModelModeState(mode);
    try {
      localStorage.setItem(MODEL_MODE_KEY, mode);
    } catch {
      /* noop */
    }
  }, []);

  const abortRef = useRef<AbortController | null>(null);
  const activeIdRef = useRef<string | null>(null);
  // Cuando sendMessage crea una conv nueva, NO queremos que el useEffect del
  // activeId resetee los messages — el optimistic user msg ya está seteado y
  // getMessages() devolvería [] (conv nueva sin nada en backend). Marcamos
  // el id aquí para que el effect lo skipee una sola vez.
  const skipNextLoadRef = useRef<string | null>(null);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  // Setter sync que actualiza el ref ANTES del setState. Eliminar la race
  // condition donde sendMessage leía `activeIdRef.current` stale (aún null)
  // entre un `setActiveIdState(newConv)` y el siguiente render → creaba una
  // segunda conv duplicada (bug 2026-05-23: 2 convs en 300ms, mensaje "Que me
  // propones?" cayó en conv distinta a la del precio stickers).
  const setActive = useCallback((id: string | null) => {
    activeIdRef.current = id;
    setActiveIdState(id);
  }, []);

  // Carga inicial de conversaciones
  useEffect(() => {
    if (!userId) return;
    listConversations()
      .then(setConversations)
      .catch((err) => console.warn("[useChat] listConversations failed", err));
  }, [userId]);

  // Cuando cambia activeId, cargar mensajes.
  // S136: NO hacer setMessages([]) eager — espera la respuesta del backend.
  // Eager-clear borraba el optimistic user msg en algunos race conditions
  // (sendMessage seteaba [userMsg] + setActiveId, y este effect arrasaba antes
  // de que el flag skipNext se aplicara). El usuario veía "Pensando…" sin su msg.
  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    if (skipNextLoadRef.current === activeId) {
      skipNextLoadRef.current = null;
      return; // sendMessage ya seteó messages con el optimistic user msg
    }
    getMessages(activeId)
      .then((msgs) => {
        if (activeIdRef.current !== activeId) return;
        // Si el backend devuelve [] y hay msgs locales (optimistic), mantenerlos.
        // Sino el optimistic user msg se borra mid-stream.
        setMessages((prev) => (msgs.length === 0 && prev.length > 0 ? prev : msgs));
      })
      .catch((err) => console.warn("[useChat] getMessages failed", err));
  }, [activeId]);

  const setActiveId = useCallback((id: string | null) => {
    setActive(id);
  }, [setActive]);

  const newConversation = useCallback(async (): Promise<Conversation> => {
    const conv = await createConversation("noa");
    setConversations((prev) => [conv, ...prev]);
    setActive(conv.id);
    return conv;
  }, [setActive]);

  const deleteConversation = useCallback(
    async (id: string) => {
      try {
        await apiDeleteConversation(id);
      } catch (err) {
        console.warn("[useChat] delete failed", err);
      }
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeIdRef.current === id) {
        setActive(null);
        setMessages([]);
      }
    },
    [setActive],
  );

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
    setLoadingHint(null);
  }, []);

  const sendMessage = useCallback(
    async (text: string, opts: Partial<SendMessagePayload> = {}) => {
      // S139 fix: permitir send con texto vacío SI hay attachment (image o file).
      // Antes `if (!text.trim()) return` abortaba silencioso la 2ª+ imagen/archivo
      // que el AppShell mandaba como mensajes separados sin texto.
      const hasAttachment = Boolean(
        opts.image_base64 || opts.file_base64 || opts.image_url,
      );
      if ((!text.trim() && !hasAttachment) || loading) return;

      // Garantizar conversación activa. Si no hay activa, creamos una pero
      // NO disparamos el load del useEffect — vamos a setear messages a mano
      // con el optimistic user msg + flag para skipear la próxima carga.
      const existingId = activeIdRef.current;
      const isNewConv = !existingId;
      let convId: string;
      if (existingId) {
        convId = existingId;
      } else {
        const conv = await createConversation("noa");
        setConversations((prev) => [conv, ...prev]);
        convId = conv.id;
      }

      // Optimistic user message — S139 fix: incluir image_base64 como data URL
      // para que la imagen aparezca visualmente apenas el user envía, antes
      // de que llegue la respuesta del backend. Multi-attachment: la 1ª imagen
      // se muestra en este msg + setMessages append N-1 rows extra (1 por
      // imagen adicional) + 1 row por file con placeholder 📎. Eso matchea
      // el patrón de persistencia del backend (1 row text + N rows imagen).
      const asDataUrl = (b64: string) =>
        b64.startsWith("data:") ? b64 : `data:image/png;base64,${b64}`;
      const optimisticImage: string | undefined = opts.image_base64
        ? asDataUrl(opts.image_base64)
        : opts.image_url || undefined;
      const optimisticContent: string = text || (
        opts.file_name
          ? `📎 ${opts.file_name}`
          : (opts.image_base64 || opts.image_url ? "" : "")
      );
      const userMsg: ChatMessage = {
        id: `tmp-${Date.now()}`,
        conversation_id: convId,
        role: "user",
        content: optimisticContent,
        image: optimisticImage,
        created_at: new Date().toISOString(),
      };
      // Rows extra optimistic: 1 por imagen adicional + 1 por file adicional
      const extraOptimisticMsgs: ChatMessage[] = [];
      const baseTs = Date.now();
      (opts.images || []).forEach((b64: string, i: number) => {
        if (!b64) return;
        extraOptimisticMsgs.push({
          id: `tmp-${baseTs}-img-${i}`,
          conversation_id: convId,
          role: "user",
          content: "",
          image: asDataUrl(b64),
          created_at: new Date(baseTs + i + 1).toISOString(),
        });
      });
      (opts.files || []).forEach((f, i: number) => {
        if (!f?.base64) return;
        extraOptimisticMsgs.push({
          id: `tmp-${baseTs}-file-${i}`,
          conversation_id: convId,
          role: "user",
          content: `📎 ${f.name || "archivo"}`,
          created_at: new Date(baseTs + 1000 + i).toISOString(),
        });
      });

      if (isNewConv) {
        // Conv recién creada: marcar para skipear el load, setear messages, activar conv,
        // y notificar al consumer (AppShell) para que sincronice el URL.
        // El orden importa: skipNextLoadRef ANTES de setActive evita que el
        // useEffect del [activeId] dispare getMessages([]) y pise el userMsg
        // optimista (bug P1-1 audit S139).
        skipNextLoadRef.current = convId;
        setMessages([userMsg, ...extraOptimisticMsgs]);
        setActive(convId);
        onConversationCreated?.(convId);
      } else {
        setMessages((prev) => [...prev, userMsg, ...extraOptimisticMsgs]);
      }
      setLoading(true);
      setStreamingText("");
      setLoadingHint("Pensando…");

      const abort = new AbortController();
      abortRef.current = abort;

      // Resolver thinking_level según el mode (sin auto):
      //   - standard → medium (Gemini 3.5 Pro thinking=medium)
      //   - pro      → high   (Gemini 3.5 Pro thinking=high)
      const resolvedLevel: ThinkingLevel = resolveThinkingLevel(modelMode);

      const payload: SendMessagePayload = {
        message: text,
        conversation_id: convId,
        agent: "noa",
        thinking_level: resolvedLevel,
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
              // Notificar a la galería que hay imagen nueva → recarga primera página
              // (S136: sin esto, la imagen recién generada no aparece hasta que el user
              // navega manualmente a Galería y la página se re-monta).
              if (url) {
                window.dispatchEvent(
                  new CustomEvent("noa:image-generated", { detail: { url } }),
                );
              }
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

        // Auto-title: el backend genera título en ~5-8s tras el primer turno.
        // Refrescamos la lista a los 7s para que el sidebar tome el nuevo título.
        // Solo si la conversación actual todavía tiene el title default.
        const currentConv = conversations.find((c) => c.id === convId);
        const stillDefault =
          !currentConv?.title ||
          ["nueva conversación", "nueva conversacion", "new conversation"].includes(
            currentConv.title.trim().toLowerCase(),
          );
        if (stillDefault) {
          setTimeout(() => {
            listConversations()
              .then(setConversations)
              .catch(() => {});
          }, 7000);
        }
      }
    },
    // P3-7 audit: messages y newConversation no se usan en el body — sacarlos
    // evita re-create de sendMessage en cada streaming delta.
    [loading, modelMode, conversations, onConversationCreated, setActive],
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
    modelMode,
    setModelMode,
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
