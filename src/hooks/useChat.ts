import { useState, useCallback, useEffect, useRef } from "react";
import {
  streamNoaMessage,
  streamKronosMessage,
  fetchConversations,
  createConversation as createConvApi,
  deleteConversationApi,
  updateConversationTitle,
  fetchMessages,
  saveMessages,
  deleteMessages as deleteMessagesApi,
  assignConversationProject,
  recoverLastAssistantMessage,
  type ServerConversation,
  type ServerMessage,
  type ThinkingLevel,
} from "../lib/api";

export type Agent = "noa" | "kronos";
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
  const [agent, setAgentState] = useState<Agent>("noa");
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
  // Última imagen generada en la conversación activa — para edit rápido
  const [lastGeneratedImage, setLastGeneratedImage] = useState<{ url: string; messageId?: string } | null>(null);
  const [syncing, setSyncing] = useState(true);
  const initialLoadDone = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  // Track qué convo IDs ya pedimos al backend, para no re-fetchar en loop
  const fetchedMessagesRef = useRef<Set<string>>(new Set());

  const active = conversations.find((c) => c.id === activeId) || null;

  // Ref sincronizado con conversations — evita que sendMessage se re-cree
  // en cada token del stream (que actualiza conversations → deps cambian).
  const conversationsRef = useRef(conversations);
  conversationsRef.current = conversations;

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

      const convo = conversationsRef.current.find((c) => c.id === convoId);
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
              : imageEngine === "sdxl" || imageEngine?.startsWith("sdxl-")
                ? "Generando con SDXL (~10s)..."
                : "Generando imagen..."
        : "Pensando..."; // NUEVO: default para chat normal (antes era null → solo dots)
      setLoadingHint(initialHint);

      // NUEVO: rotación de hints para chat normal mientras espera primer token.
      // Apenas llega el primer token, streamingText toma el relevo visual (StreamingBubble),
      // así que este rotator solo se ve durante el "pensamiento inicial".
      let rotateTimer: ReturnType<typeof setInterval> | null = null;
      if (!imageMode && !editMode) {
        const CHAT_HINTS = [
          "Pensando...",
          "Consultando contexto...",
          "Revisando memoria...",
          "Buscando la mejor respuesta...",
          "Casi listo...",
        ];
        let hintIdx = 0;
        rotateTimer = setInterval(() => {
          hintIdx = (hintIdx + 1) % CHAT_HINTS.length;
          setLoadingHint(CHAT_HINTS[hintIdx]);
        }, 2500);
      }

      // Hint de cold start: si después de 8s sigue cargando y es un engine de Modal,
      // mostrar mensaje explicativo (el GPU se está calentando, primer request del día)
      const isModalEngine =
        imageMode &&
        (imageEngine === "zimage" ||
          imageEngine === "flux2" ||
          imageEngine === "studioflux-raw" ||
          imageEngine === "sdxl" ||
          imageEngine?.startsWith("sdxl-"));
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
          // Defensive cleanup: si hay un video huérfano de un stream anterior
          // interrumpido, remover antes de crear uno nuevo
          document
            .querySelectorAll("video[data-nosleep-wakelock]")
            .forEach((v) => {
              try { (v as HTMLVideoElement).pause(); } catch { /* ignore */ }
              v.remove();
            });
          noSleepVideo = document.createElement("video");
          noSleepVideo.setAttribute("playsinline", "");
          noSleepVideo.setAttribute("muted", "");
          noSleepVideo.setAttribute("data-nosleep-wakelock", "1");
          noSleepVideo.muted = true;
          noSleepVideo.loop = true;
          // Tiny blank MP4 (smallest valid video, ~200 bytes base64)
          noSleepVideo.src = "data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAAhmcmVlAAAAGm1kYXQAAABfAQAAAF8BAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHG==";
          // Position off-screen sin afectar layout (similar al fix de download)
          noSleepVideo.style.position = "fixed";
          noSleepVideo.style.left = "-9999px";
          noSleepVideo.style.width = "1px";
          noSleepVideo.style.height = "1px";
          noSleepVideo.style.opacity = "0";
          noSleepVideo.style.pointerEvents = "none";
          noSleepVideo.setAttribute("aria-hidden", "true");
          document.body.appendChild(noSleepVideo);
          await noSleepVideo.play().catch(() => {});
        } catch { /* fallback no disponible */ }
      }

      // Phase D fix #1: abort any in-flight controller antes de crear uno nuevo
      // (evita que 2 streams paralelos se pisen cuando el user envía rápido)
      if (abortRef.current) {
        try { abortRef.current.abort(); } catch { /* ignore */ }
      }

      // Phase D fix #2: flag para detectar silent fail — si termina sin haber agregado
      // mensaje (ni éxito ni error), el finally agrega un mensaje de emergencia
      let messageAdded = false;

      try {
        let assistantContent = "";
        let assistantImage: string | undefined;
        let assistantImageMetadata: ImageMetadata | undefined;

        const MAX_STREAM_RETRIES = 1;

        if (agent === "noa") {
          for (let attempt = 0; attempt <= MAX_STREAM_RETRIES; attempt++) {
            try {
              // Crear nuevo AbortController para este stream — guardado en ref
              // para que sea cancelable desde fuera (futuro botón "Stop")
              abortRef.current = new AbortController();
              const res = await streamNoaMessage(
                displayText,
                convoId || undefined,
                imageBase64,
                imageMode,
                imageEngine,
                {
                  onToken: (accumulated) => setStreamingText(accumulated),
                  onImage: (img, meta) => {
                    // Si ya hay una imagen previa, la primera va al texto como markdown img
                    if (assistantImage && img !== assistantImage) {
                      assistantContent += `\n\n![imagen](${assistantImage})\n\n`;
                    }
                    assistantImage = img;
                    // Guardar como última imagen generada para edit rápido
                    if (img) setLastGeneratedImage({ url: img });
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
                console.warn("[useChat] Empty response from Noa, retrying...");
                await new Promise((r) => setTimeout(r, 1000));
              }
            } catch (streamErr) {
              if (attempt < MAX_STREAM_RETRIES) {
                setStreamingText("");
                console.warn("[useChat] Stream error, retrying...", streamErr);
                await new Promise((r) => setTimeout(r, 1500));
              } else {
                // Antes de fallar: intentar recuperar del servidor (iOS background)
                if (convoId && (imageMode || editMode)) {
                  console.info("[useChat] Stream lost — attempting server recovery...");
                  setLoadingHint("Reconectando...");
                  // Esperar un poco para que el backend termine de persistir
                  await new Promise((r) => setTimeout(r, 3000));
                  const recovered = await recoverLastAssistantMessage(convoId);
                  if (recovered && (recovered.image || recovered.content)) {
                    console.info("[useChat] Recovery OK — got message from server");
                    assistantContent = recovered.content || "(imagen generada)";
                    assistantImage = recovered.image;
                    break;
                  }
                }
                throw streamErr;
              }
            }
          }
          if (!assistantContent) {
            // Último intento: recovery del servidor
            if (convoId && (imageMode || editMode)) {
              const recovered = await recoverLastAssistantMessage(convoId);
              if (recovered && (recovered.image || recovered.content)) {
                console.info("[useChat] Recovery (post-retry) OK");
                assistantContent = recovered.content || "(imagen generada)";
                assistantImage = recovered.image;
              }
            }
          }
          if (!assistantContent) {
            console.warn("[useChat] Empty assistantContent after all retries", {
              convoId,
              activeId,
              imageMode,
              editMode,
              hasImage: !!assistantImage,
            });
            assistantContent = assistantImage
              ? "(imagen generada)"
              : "No pude generar una respuesta. Intenta enviar tu mensaje de nuevo.";
          }
          setStreamingText("");
        } else {
          const MAX_HISTORY_MESSAGES = 40;
          const history =
            conversationsRef.current
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

        setConversations((prev) => {
          // Phase D fix: verificar que la convo target exista, sino warn
          const targetExists = prev.some((c) => c.id === convoId);
          if (!targetExists) {
            console.error("[useChat] Convo gone when adding assistant msg", {
              convoId,
              prevIds: prev.map((c) => c.id),
            });
            return prev;
          }
          return prev.map((c) =>
            c.id === convoId ? { ...c, messages: [...c.messages, assistantMsg] } : c,
          );
        });
        messageAdded = true;

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
        messageAdded = true;
        setStreamingText("");
      } finally {
        // Phase D fix: safety net — si por alguna razón el try/catch terminó sin agregar
        // mensaje (silent fail), añadir uno de emergencia para que el user no se quede
        // con el spinner desaparecido y sin ninguna respuesta.
        if (!messageAdded) {
          console.error("[useChat] Silent fail detected — no message added!", { convoId, activeId });
          const safetyMsg: Message = {
            id: crypto.randomUUID(),
            role: "assistant",
            agent,
            content: "Ups, algo pasó con la respuesta. Intenta enviar tu mensaje de nuevo.",
            timestamp: Date.now(),
          };
          setConversations((prev) =>
            prev.map((c) =>
              c.id === convoId ? { ...c, messages: [...c.messages, safetyMsg] } : c,
            ),
          );
        }
        if (coldStartTimer) clearTimeout(coldStartTimer);
        if (rotateTimer) clearInterval(rotateTimer); // Phase C cleanup
        setLoading(false);
        setLoadingHint(null);
        if (wakeLock) { wakeLock.release().catch(() => {}); }
        if (noSleepVideo) { noSleepVideo.pause(); noSleepVideo.remove(); }
      }
    },
    [activeId, agent, loading, thinkingLevel, newConversation],
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
      // La confirmación la hace el caller (ChatHistoryPage con Dialog shadcn).
      // Aquí solo ejecutamos la eliminación optimista + backend.
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

  /**
   * Cancela el stream activo (si hay). El backend seguirá generando la
   * imagen/respuesta pero el frontend dejará de esperar. Usado por el
   * botón "■ Detener" en ChatInput.
   */
  const stopGeneration = useCallback(() => {
    if (abortRef.current) {
      try {
        abortRef.current.abort();
      } catch {
        // ignore
      }
    }
  }, []);

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
    stopGeneration,
    newConversation,
    deleteConversation,
    deleteMessages,
    moveToProject,
    renameConversation,
    lastGeneratedImage,
  };
}
