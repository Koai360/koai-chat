import { useEffect, useRef } from "react";
import { MessageBubble, StreamingBubble } from "./MessageBubble";
import { ChatInput } from "./ChatInput";
import type { Conversation, Agent, Message } from "../hooks/useChat";

interface Props {
  conversation: Conversation | null;
  agent: Agent;
  loading: boolean;
  streamingText: string;
  onSend: (text: string, imageBase64?: string) => void;
  onTranscribe: (blob: Blob) => Promise<string>;
}

const SUGGESTIONS: Record<Agent, string[]> = {
  kira: [
    "Hola, qué servicios ofrece KOAI?",
    "Cotizar stickers personalizados",
    "Estado de un pedido",
  ],
  kronos: [
    "Estado del sistema",
    "Qué endpoints tiene la API?",
    "Resumen de la arquitectura",
  ],
};

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

export function ChatView({ conversation, agent, loading, streamingText, onSend, onTranscribe }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation?.messages.length, streamingText]);

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 chat-scroll">
        {!conversation || conversation.messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-8 animate-fade-in">
            <img
              src={agent === "kira" ? "/icons/kira-logo.svg" : "/icons/koai-192.png"}
              alt={agent === "kira" ? "Kira" : "Kronos"}
              className="w-20 h-20 rounded-2xl mb-4 shadow-lg"
            />
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-0.5">
              {agent === "kira" ? "Kira" : "Kronos"}
            </h2>
            <p className="text-[13px] text-gray-500 dark:text-gray-400 max-w-xs mb-1">
              {agent === "kira"
                ? "Asistente de ventas y soporte 24/7"
                : "Asistente técnico de KOAI Studios"}
            </p>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium mb-6 bg-[#bcd431]/10 text-[#bcd431] dark:bg-[#bcd431]/10">
              <span className="w-1.5 h-1.5 rounded-full bg-[#bcd431]" />
              En línea
            </div>
            <div className="flex flex-wrap justify-center gap-2 max-w-xs">
              {SUGGESTIONS[agent].map((s) => (
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
              <MessageBubble message={msg} />
            </div>
          ))
        )}

        {/* Streaming indicator */}
        {loading && streamingText && (
          <StreamingBubble text={streamingText} agent={agent} />
        )}

        {/* Typing indicator */}
        {loading && !streamingText && (
          <div className="flex justify-start mb-2 animate-bubble-in">
            <div className="rounded-[18px] px-4 py-3 rounded-bl-[4px] bg-[#f5f3f7] dark:bg-[#1e1b22]">
              <div className="flex gap-1">
                <span className="w-[7px] h-[7px] bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-[7px] h-[7px] bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-[7px] h-[7px] bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
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
