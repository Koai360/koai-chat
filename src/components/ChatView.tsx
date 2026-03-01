import { useEffect, useRef } from "react";
import { MessageBubble, StreamingBubble } from "./MessageBubble";
import { ChatInput } from "./ChatInput";
import type { Conversation, Agent } from "../hooks/useChat";

interface Props {
  conversation: Conversation | null;
  agent: Agent;
  loading: boolean;
  streamingText: string;
  onSend: (text: string) => void;
}

export function ChatView({ conversation, agent, loading, streamingText, onSend }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation?.messages.length, streamingText]);

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {!conversation || conversation.messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <div className="text-5xl mb-4">
              {agent === "kira" ? "💬" : "⚡"}
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
              {agent === "kira" ? "Chat con Kira" : "Chat con Kronos"}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">
              {agent === "kira"
                ? "Asistente de ventas y soporte 24/7. Pregunta lo que necesites sobre KOAI Studios."
                : "Asistente técnico de KOAI. Consulta estado del sistema, arquitectura, o planificación."}
            </p>
          </div>
        ) : (
          conversation.messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))
        )}

        {/* Streaming indicator */}
        {loading && streamingText && (
          <StreamingBubble text={streamingText} agent={agent} />
        )}

        {/* Typing indicator (for Kira, non-streaming) */}
        {loading && !streamingText && (
          <div className="flex justify-start mb-3">
            <div className={`rounded-2xl px-4 py-3 rounded-bl-md ${
              agent === "kira" ? "bg-pink-50 dark:bg-pink-950/30" : "bg-indigo-50 dark:bg-indigo-950/30"
            }`}>
              <div className="flex gap-1.5">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <ChatInput
        onSend={onSend}
        disabled={loading}
        placeholder={agent === "kira" ? "Pregunta a Kira..." : "Pregunta a Kronos..."}
      />
    </div>
  );
}
