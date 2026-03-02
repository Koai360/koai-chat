import { useEffect, useRef, useCallback } from "react";
import { MessageBubble, StreamingBubble } from "./MessageBubble";
import { ChatInput } from "./ChatInput";
import type { Conversation, Agent, Message } from "../hooks/useChat";

interface Props {
  conversation: Conversation | null;
  agent: Agent;
  loading: boolean;
  loadingHint?: string | null;
  streamingText: string;
  onSend: (text: string, imageBase64?: string, imageMode?: boolean, imageEngine?: string) => void;
  onTranscribe: (blob: Blob) => Promise<string>;
  userName?: string;
  onImageClick?: (imageSrc: string) => void;
}

function getGreeting(name?: string): string {
  const hour = new Date().getHours();
  const displayName = name || "Usuario";
  if (hour < 12) return `Buenos días, ${displayName}`;
  if (hour < 18) return `Buenas tardes, ${displayName}`;
  return `Buenas noches, ${displayName}`;
}

function getSuggestions(agent: Agent): string[] {
  const hour = new Date().getHours();

  if (agent === "kronos") {
    return [
      "Estado del sistema",
      "Resumen de la arquitectura",
      "Qué endpoints tiene la API?",
    ];
  }

  // Kira — sugerencias según hora
  if (hour < 12) {
    return [
      "Qué tengo pendiente hoy?",
      "Resumen de mensajes nuevos",
      "Cotizar stickers personalizados",
    ];
  }
  if (hour < 18) {
    return [
      "Estado de los pedidos",
      "Genera una imagen para un post",
      "Cotizar stickers personalizados",
    ];
  }
  return [
    "Resumen de lo que se hizo hoy",
    "Qué quedó pendiente?",
    "Programa una tarea para mañana",
  ];
}

function formatDateLabel(timestamp: number): string {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Hoy";
  if (date.toDateString() === yesterday.toDateString()) return "Ayer";
  return date.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" });
}

function shouldShowDate(messages: Message[], index: number): boolean {
  if (index === 0) return true;
  const prev = new Date(messages[index - 1].timestamp).toDateString();
  const curr = new Date(messages[index].timestamp).toDateString();
  return prev !== curr;
}

export function ChatView({ conversation, agent, loading, loadingHint, streamingText, onSend, onTranscribe, userName, onImageClick }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);

  // Track if user is near bottom
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const threshold = 120;
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  }, []);

  // Auto-scroll only if near bottom
  useEffect(() => {
    if (!isNearBottomRef.current) return;
    const isMobile = window.innerWidth < 768;
    bottomRef.current?.scrollIntoView({ behavior: isMobile ? "auto" : "smooth" });
  }, [conversation?.messages.length, streamingText]);

  // Force scroll to bottom on conversation switch
  useEffect(() => {
    isNearBottomRef.current = true;
    bottomRef.current?.scrollIntoView({ behavior: "auto" });
  }, [conversation?.id]);

  const suggestions = getSuggestions(agent);

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 py-2 chat-scroll"
      >
        {!conversation || conversation.messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-8 animate-fade-in">
            <img
              src={agent === "kira" ? "/icons/kira-logo.svg" : "/icons/kronos-logo.svg"}
              alt={agent === "kira" ? "Kira" : "Kronos"}
              className="w-20 h-20 rounded-2xl mb-4 shadow-lg"
            />
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-0.5">
              {getGreeting(userName)}
            </h2>
            <p className="text-[13px] text-gray-500 dark:text-gray-400 max-w-xs mb-1">
              {agent === "kira"
                ? "Soy Kira, tu asistente de KOAI Studios"
                : "Soy Kronos, arquitecto de código"}
            </p>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium mb-6 bg-[#bcd431]/10 text-[#bcd431] dark:bg-[#bcd431]/10">
              <span className="w-1.5 h-1.5 rounded-full bg-[#bcd431]" />
              En línea
            </div>
            <div className="flex flex-wrap justify-center gap-2 max-w-xs">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => onSend(s)}
                  disabled={loading}
                  className={`px-3.5 py-2 rounded-2xl border text-xs transition-all disabled:opacity-50 active:scale-95 ${
                    agent === "kronos"
                      ? "border-[#bcd431]/20 dark:border-[#bcd431]/30 text-gray-600 dark:text-gray-400 hover:border-[#bcd431]/50 hover:text-[#bcd431] hover:bg-[#bcd431]/5 dark:hover:bg-[#bcd431]/10"
                      : "border-[#572c77]/20 dark:border-[#572c77]/30 text-gray-600 dark:text-gray-400 hover:border-[#572c77]/50 hover:text-[#572c77] hover:bg-[#572c77]/5 dark:hover:bg-[#572c77]/10"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          conversation.messages.map((msg, i) => (
            <div key={msg.id}>
              {shouldShowDate(conversation.messages, i) && (
                <div className="date-separator text-gray-500 dark:text-gray-400">
                  <span>{formatDateLabel(msg.timestamp)}</span>
                </div>
              )}
              <MessageBubble message={msg} onImageClick={onImageClick} />
            </div>
          ))
        )}

        {/* Streaming indicator */}
        {loading && streamingText && (
          <StreamingBubble text={streamingText} agent={agent} />
        )}

        {/* Typing / generating indicator */}
        {loading && !streamingText && (
          <div className="flex justify-start mb-2 animate-bubble-in">
            <div className="rounded-[18px] px-4 py-3 rounded-bl-[4px] bg-[#f5f3f7] dark:bg-[#1e1b22]">
              {loadingHint ? (
                <div className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4 text-[#572c77] dark:text-[#bcd431] flex-shrink-0" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{loadingHint}</span>
                </div>
              ) : (
                <div className="flex gap-1">
                  <span className="w-[7px] h-[7px] bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-[7px] h-[7px] bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-[7px] h-[7px] bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              )}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <ChatInput
        onSend={onSend}
        onTranscribe={onTranscribe}
        disabled={loading}
        placeholder={agent === "kira" ? "Pregunta a Kira..." : "Pregunta a Kronos..."}
        autoFocus={!!conversation}
        agent={agent}
      />
    </div>
  );
}
