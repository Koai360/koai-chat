import { useState, useCallback, useEffect, useRef } from "react";
import {
  streamKiraMessage,
  streamKronosMessage,
  fetchConversations,
  createConversation as createConvApi,
  deleteConversationApi,
  updateConversationTitle,
  fetchMessages,
  saveMessages,
  deleteMessages as deleteMessagesApi,
  assignConversationProject,
  type ServerConversation,
  type ServerMessage,
  type ThinkingLevel,
} from "../lib/api";

export type Agent = "kira" | "kronos";
export type { ThinkingLevel };

const THINKING_LEVEL_KEY = "koai.chat.thinkingLevel";

function loadThinkingLevel(): ThinkingLevel {
  try {
    const v = localStorage.getItem(THINKING_LEVEL_KEY);
    if (v === "low" || v === "medium" || v === "high") return v;
  } catch { /* ignore */ }
  return "medium";
}

export interface ImageMetadata {
  /** Engine identifier — matches keys in ENGINE_DISPLAY at ImageMetadataBadge.tsx */
  engine: string;
  /** Generation time in milliseconds (end-to-end including queueing/cold start) */
  generationTimeMs?: number;
  /** Estimated cost in USD */
  costEstimateUsd?: number;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  agent: Agent;
  content: string;
  timestamp: number;
  image?: string;
  imageMetadata?: ImageMetadata;
}

export interface Conversation {
  id: string;
  agent: Agent;
  messages: Message[];
  createdAt: number;
  title: string;
  projectId?: string | null;
}

function generateTitle(msg: string): string {
  return msg.length > 40 ? msg.slice(0, 40) + "..." : msg;
}

function serverToLocal(sc: ServerConversation): Conversation {
  return {
    id: sc.id,
    agent: sc.agent as Agent,
    messages: [],
    createdAt: new Date(sc.created_at).getTime(),
    title: sc.title,
    projectId: sc.project_id || null,
  };
}

function serverMsgToLocal(sm: ServerMessage): Message {
  return {
    id: sm.id,
    role: sm.role as "user" | "assistant",
    agent: sm.agent as Agent,
    content: sm.content,
    timestamp: new Date(sm.created_at).getTime(),
    image: sm.image || undefined,
  };
}

export function useChat(userId: string | null = null) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [agent, setAgentState] = useState<Agent>("kira");
  const [thinkingLevel, setThinkingLevelState] = useState<ThinkingLevel>(loadThinkingLevel);
  const [loading, setLoading] = useState(false);

  const setThinkingLevel = useCallback((level: ThinkingLevel) => {
    setThinkingLevelState(level);
    try {
      localStorage.setItem(THINKING_LEVEL_KEY, level);
    } catch { /* ignore */ }
  }, []);
  const [loadingHint, setLoadingHint] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState("");
  const [syncing, setSyncing] = useState(true);
  const initialLoadDone = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  // Track qué convo IDs ya pedimos al backend, para no re-fetchar en loop
  const fetchedMessagesRef = useRef<Set<string>>(new Set());

  const active = conversations.find((c) => c.id === activeId) || null;

  // Load conversations from server on init
  useEffect(() => {
    if (!userId) return;
    initialLoadDone.current = false;
    setSyncing(true);

    fetchConversations()
      .then((serverConvos) => {
        const local = serverConvos.map(serverToLocal);
        setConversations(local);
        initialLoadDone.current = true;
      })
      .catch((err) => {
        console.error("[useChat] Failed to fetch conversations:", err);
        initialLoadDone.current = true;
      })
      .finally(() => setSyncing(false));
  }, [userId]);

  // Load messages cuando una convo se activa por primera vez.
  // CRITICAL: dependency array SOLO tiene `activeId`. Tener `conversations`
  // en las deps causaba un loop infinito de ~1 fetch/segundo porque
  // `setConversations` creaba nueva referencia → re-disparaba effect
  // → re-fetchaba → sobrescribía el stream en progreso con `messages: []`
  // (eso causaba "a veces escribo y no me responde").
  useEffect(() => {
    if (!activeId || !initialLoadDone.current) return;
    // Evitar re-fetch de convos ya cargadas (aunque el state haya cambiado)
    if (fetchedMessagesRef.current.has(activeId)) return;

    fetchedMessagesRef.current.add(activeId);
    fetchMessages(activeId)
      .then((serverMsgs) => {
        if (serverMsgs.length === 0) return;
        const msgs = serverMsgs.map(serverMsgToLocal);
        setConversations((prev) =>
          prev.map((c) => {
            if (c.id !== activeId) return c;
            // No sobrescribir si el state local ya tiene mensajes (caso:
            // el user envió algo y el streaming ya empezó)
            if (c.messages.length > 0) return c;
            return { ...c, messages: msgs };
          })
        );
      })
      .catch((err) => {
        console.error("[useChat] Failed to fetch messages:", err);
        // Permitir retry en próximo select
        fetchedMessagesRef.current.delete(activeId);
      });
  }, [activeId]);

  // When agent changes, switch to the most recent conversation of that agent
  const setAgent = useCallback(
    (newAgent: Agent) => {
      setAgentState(newAgent);
      const agentConvos = conversations.filter((c) => c.agent === newAgent);
      if (agentConvos.length > 0) {
        setActiveId(agentConvos[0].id);
      } else {
        setActiveId(null);
      }
    },
    [conversations],
  );

  const newConversation = useCallback(async () => {
    // Optimistic update — crear la convo inmediatamente en state antes de
    // esperar al backend. El user ve el chat vacío sin lag percibido.
    const tempId = crypto.randomUUID();
    const optimistic: Conversation = {
      id: tempId,
      agent,
      messages: [],
      createdAt: Date.now(),
      title: "Nueva conversación",
    };
    setConversations((prev) => [optimistic, ...prev]);
    setActiveId(tempId);

    try {
      const serverConvo = await createConvApi(agent, "Nueva conversación");
      const real = serverToLocal(serverConvo);
      // Reemplazar la convo optimistic con la real del backend
      setConversations((prev) => prev.map((c) => (c.id === tempId ? real : c)));
      setActiveId(real.id);
      return real.id;
    } catch (err) {
      console.error("[useChat] Failed to create conversation (keeping optimistic):", err);
      return tempId;
    }
  }, [agent]);

  const sendMessage = useCallback(
    async (text: string, imageBase64?: string, imageMode?: boolean, imageEngine?: string, editMode?: boolean, imageUrl?: string) => {
      if ((!text.trim() && !imageBase64 && !imageUrl) || loading) return;

      let convoId = activeId;
      if (!convoId) {
        convoId = await newConversation();
      }

      const displayText = text.trim() || ((imageBase64 || imageUrl) ? "[Imagen]" : "");
      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        agent,
        content: displayText,
        timestamp: Date.now(),
        // Para mostrar en chat: usa la URL R2 si hay edit_url (liviano),
        // sino base64 inline (upload manual)
        image: imageUrl || imageBase64,
      };

      const convo = conversations.find((c) => c.id === convoId);
      const isFirstMsg = !convo || convo.messages.length === 0;
      const newTitle = isFirstMsg ? generateTitle(displayText) : undefined;

      setConversations((prev) =>
        prev.map((c) =>
          c.id === convoId
            ? { ...c, title: newTitle || c.title, messages: [...c.messages, userMsg] }
            : c,
        ),
      );

      if (newTitle && convoId) {
        updateConversationTitle(convoId, newTitle).catch(() => {});
      }

      setLoading(true);
      // Hint inicial — mensaje según modo + engine.
      const initialHint = editMode
        ? "Editando con Flux Kontext Pro (~8s, fallback Modal si filtra)..."
        : imageMode
        ? imageEngine === "flux2"
          ? "Generando con Flux.2 Pro (32B premium, ~30-60s)..."
          : imageEngine === "zimage"
            ? "Generando con Z-Image-Turbo (~5s)..."
            : imageEngine === "studioflux-raw"
              ? "Generando con Studio RAW (~5-30s)..."
              : "Generando imagen..."
        : null;
      setLoadingHint(initialHint);

      // Hint de cold start: si después de 8s sigue cargando y es un engine de Modal,
      // mostrar mensaje explicativo (el GPU se está calentando, primer request del día)
      const isModalEngine =
        imageMode &&
        (imageEngine === "zimage" ||
          imageEngine === "flux2" ||
          imageEngine === "studioflux-raw");
      const coldStartTimer = isModalEngine
        ? setTimeout(() => {
            setLoadingHint(
              imageEngine === "flux2"
                ? "Calentando GPU para Flux.2 (cold start ~60-90s)..."
                : "Calentando GPU (cold start ~30-60s)..."
            );
          }, 8000)
        : editMode
          ? setTimeout(() => {
              setLoadingHint("BFL filtró contenido — probando Modal Kontext Dev sin filtro (~45s)...");
            }, 15000)
          : null;
      setStreamingText("");

      // Mantener pantalla encendida durante generación (evita que iOS mate el fetch)
      let wakeLock: WakeLockSentinel | null = null;
      let noSleepVideo: HTMLVideoElement | null = null;
      try {
        if ("wakeLock" in navigator) {
          wakeLock = await navigator.wakeLock.request("screen");
        }
      } catch { /* Wake Lock API no disponible */ }
      // Fallback iOS: video silencioso mantiene pantalla activa
      if (!wakeLock) {
        try {
          noSleepVideo = document.createElement("video");
          noSleepVideo.setAttribute("playsinline", "");
          noSleepVideo.setAttribute("muted", "");
          noSleepVideo.muted = true;
          noSleepVideo.loop = true;
          // Tiny blank MP4 (smallest valid video, ~200 bytes base64)
          noSleepVideo.src = "data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAAhmcmVlAAAAGm1kYXQAAABfAQAAAF8BAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHG==";
          noSleepVideo.style.position = "fixed";
          noSleepVideo.style.top = "-1px";
          noSleepVideo.style.width = "1px";
          noSleepVideo.style.height = "1px";
          noSleepVideo.style.opacity = "0";
          document.body.appendChild(noSleepVideo);
          await noSleepVideo.play().catch(() => {});
        } catch { /* fallback no disponible */ }
      }

      try {
        let assistantContent = "";
        let assistantImage: string | undefined;
        let assistantImageMetadata: ImageMetadata | undefined;

        const MAX_STREAM_RETRIES = 1;

        if (agent === "kira") {
          for (let attempt = 0; attempt <= MAX_STREAM_RETRIES; attempt++) {
            try {
              // Crear nuevo AbortController para este stream — guardado en ref
              // para que sea cancelable desde fuera (futuro botón "Stop")
              abortRef.current = new AbortController();
              const res = await streamKiraMessage(
                displayText,
                convoId || undefined,
                imageBase64,
                imageMode,
                imageEngine,
                {
                  onToken: (accumulated) => setStreamingText(accumulated),
                  onImage: (img, meta) => {
                    assistantImage = img;
                    if (meta) {
                      assistantImageMetadata = {
                        engine: meta.engine,
                        generationTimeMs: meta.generation_time_ms,
                        costEstimateUsd: meta.cost_estimate_usd,
                      };
                    }
                  },
                },
                abortRef.current.signal,
                thinkingLevel,
                editMode,
                imageUrl,
              );
              assistantContent = res.fullText || "";
              assistantImage = assistantImage || (res.image ?? undefined);
              // Si callback no recibió metadata pero el return sí, usarla
              if (!assistantImageMetadata && res.imageMetadata) {
                assistantImageMetadata = {
                  engine: res.imageMetadata.engine,
                  generationTimeMs: res.imageMetadata.generation_time_ms,
                  costEstimateUsd: res.imageMetadata.cost_estimate_usd,
                };
              }
              if (assistantContent) break;
              // Respuesta vacia — reintentar una vez
              if (attempt < MAX_STREAM_RETRIES) {
                setStreamingText("");
                console.warn("[useChat] Empty response from Kira, retrying...");
                await new Promise((r) => setTimeout(r, 1000));
              }
            } catch (streamErr) {
              if (attempt < MAX_STREAM_RETRIES) {
                setStreamingText("");
                console.warn("[useChat] Stream error, retrying...", streamErr);
                await new Promise((r) => setTimeout(r, 1500));
              } else {
                throw streamErr;
              }
            }
          }
          if (!assistantContent) {
            assistantContent = "No pude generar una respuesta. Intenta enviar tu mensaje de nuevo.";
          }
          setStreamingText("");
        } else {
          const MAX_HISTORY_MESSAGES = 40;
          const history =
            conversations
              .find((c) => c.id === convoId)
              ?.messages.map((m) => ({
                role: m.role === "user" ? ("user" as const) : ("assistant" as const),
                content: m.content,
              }))
              .slice(-MAX_HISTORY_MESSAGES) || [];

          assistantContent = await streamKronosMessage(
            displayText,
            history,
            convoId,
            (partial) => setStreamingText(partial),
            imageBase64,
          );
          if (!assistantContent) {
            assistantContent = "No pude generar una respuesta. Intenta enviar tu mensaje de nuevo.";
          }
          setStreamingText("");
        }

        const assistantMsg: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          agent,
          content: assistantContent,
          timestamp: Date.now(),
          image: assistantImage,
          imageMetadata: assistantImageMetadata,
        };

        setConversations((prev) =>
          prev.map((c) =>
            c.id === convoId ? { ...c, messages: [...c.messages, assistantMsg] } : c,
          ),
        );

        // Persist both messages to server
        if (convoId) {
          saveMessages(convoId, [
            { role: "user", agent, content: displayText, image: imageBase64 },
            { role: "assistant", agent, content: assistantContent, image: assistantImage },
          ]).catch((err) => console.error("[useChat] Failed to save messages:", err));
        }
      } catch (err) {
        const errorMsg: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          agent,
          content: `Error: ${err instanceof Error ? err.message : "desconocido"}`,
          timestamp: Date.now(),
        };
        setConversations((prev) =>
          prev.map((c) =>
            c.id === convoId ? { ...c, messages: [...c.messages, errorMsg] } : c,
          ),
        );
        setStreamingText("");
      } finally {
        if (coldStartTimer) clearTimeout(coldStartTimer);
        setLoading(false);
        setLoadingHint(null);
        if (wakeLock) { wakeLock.release().catch(() => {}); }
        if (noSleepVideo) { noSleepVideo.pause(); noSleepVideo.remove(); }
      }
    },
    [activeId, agent, loading, conversations, newConversation],
  );

  const moveToProject = useCallback(
    (conversationId: string, projectId: string | null) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId ? { ...c, projectId } : c,
        ),
      );
      assignConversationProject(conversationId, projectId).catch((err) =>
        console.error("[useChat] Failed to assign project:", err),
      );
    },
    [],
  );

  const deleteConversation = useCallback(
    (id: string) => {
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeId === id) setActiveId(null);
      deleteConversationApi(id).catch((err) =>
        console.error("[useChat] Failed to delete:", err),
      );
    },
    [activeId],
  );

  const deleteMessages = useCallback(
    (conversationId: string, messageIds: string[]) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? { ...c, messages: c.messages.filter((m) => !messageIds.includes(m.id)) }
            : c,
        ),
      );
      deleteMessagesApi(conversationId, messageIds).catch((err) =>
        console.error("[useChat] Failed to delete messages:", err),
      );
    },
    [],
  );

  const agentConversations = conversations.filter((c) => c.agent === agent);

  const renameConversation = (id: string, newTitle: string) => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title: trimmed } : c))
    );
    updateConversationTitle(id, trimmed).catch(() => {});
  };

  return {
    conversations: agentConversations,
    active,
    activeId,
    setActiveId,
    agent,
    setAgent,
    thinkingLevel,
    setThinkingLevel,
    loading,
    loadingHint,
    syncing,
    streamingText,
    sendMessage,
    newConversation,
    deleteConversation,
    deleteMessages,
    moveToProject,
    renameConversation,
  };
}
