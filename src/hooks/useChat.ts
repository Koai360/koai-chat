import { useState, useCallback, useEffect, useRef } from "react";
import {
  sendKiraMessage,
  streamKronosMessage,
  fetchConversations,
  createConversation as createConvApi,
  deleteConversationApi,
  updateConversationTitle,
  fetchMessages,
  saveMessages,
  assignConversationProject,
  type ServerConversation,
  type ServerMessage,
} from "../lib/api";

export type Agent = "kira" | "kronos";

export interface Message {
  id: string;
  role: "user" | "assistant";
  agent: Agent;
  content: string;
  timestamp: number;
  image?: string;
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
  const [loading, setLoading] = useState(false);
  const [loadingHint, setLoadingHint] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState("");
  const [syncing, setSyncing] = useState(true);
  const initialLoadDone = useRef(false);

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

  // Load messages when active conversation changes
  useEffect(() => {
    if (!activeId || !initialLoadDone.current) return;

    const convo = conversations.find((c) => c.id === activeId);
    if (!convo || convo.messages.length > 0) return;

    fetchMessages(activeId)
      .then((serverMsgs) => {
        const msgs = serverMsgs.map(serverMsgToLocal);
        setConversations((prev) =>
          prev.map((c) => (c.id === activeId ? { ...c, messages: msgs } : c))
        );
      })
      .catch((err) => {
        console.error("[useChat] Failed to fetch messages:", err);
      });
  }, [activeId, conversations]);

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
    try {
      const serverConvo = await createConvApi(agent, "Nueva conversación");
      const local = serverToLocal(serverConvo);
      setConversations((prev) => [local, ...prev]);
      setActiveId(local.id);
      return local.id;
    } catch (err) {
      console.error("[useChat] Failed to create conversation:", err);
      const id = crypto.randomUUID();
      const convo: Conversation = {
        id,
        agent,
        messages: [],
        createdAt: Date.now(),
        title: "Nueva conversación",
      };
      setConversations((prev) => [convo, ...prev]);
      setActiveId(id);
      return id;
    }
  }, [agent]);

  const sendMessage = useCallback(
    async (text: string, imageBase64?: string, imageMode?: boolean, imageEngine?: string) => {
      if ((!text.trim() && !imageBase64) || loading) return;

      let convoId = activeId;
      if (!convoId) {
        convoId = await newConversation();
      }

      const displayText = text.trim() || (imageBase64 ? "[Imagen]" : "");
      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        agent,
        content: displayText,
        timestamp: Date.now(),
        image: imageBase64,
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
      setLoadingHint(
        imageMode
          ? imageEngine === "studioflux" || imageEngine === "studioflux-raw"
            ? "Generando con Studio (puede tardar ~60s)..."
            : imageEngine === "flux"
              ? "Generando imagen con Flux 2..."
              : "Generando imagen..."
          : null,
      );
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

        if (agent === "kira") {
          const res = await sendKiraMessage(displayText, convoId, imageBase64, imageMode, imageEngine);
          assistantContent = res.messages?.[0]?.content || "Sin respuesta";
          assistantImage = res.messages?.[0]?.image || undefined;
        } else {
          const history =
            conversations
              .find((c) => c.id === convoId)
              ?.messages.map((m) => ({
                role: m.role === "user" ? ("user" as const) : ("assistant" as const),
                content: m.content,
              })) || [];

          assistantContent = await streamKronosMessage(
            displayText,
            history,
            convoId,
            (partial) => setStreamingText(partial),
            imageBase64,
          );
          assistantContent = assistantContent || "Sin respuesta";
          setStreamingText("");
        }

        const assistantMsg: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          agent,
          content: assistantContent,
          timestamp: Date.now(),
          image: assistantImage,
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

  const agentConversations = conversations.filter((c) => c.agent === agent);

  return {
    conversations: agentConversations,
    active,
    activeId,
    setActiveId,
    agent,
    setAgent,
    loading,
    loadingHint,
    syncing,
    streamingText,
    sendMessage,
    newConversation,
    deleteConversation,
    moveToProject,
  };
}
