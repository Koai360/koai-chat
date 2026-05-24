import { useEffect, useRef } from "react";
import { ChatEmpty } from "./ChatEmpty";
import { MessageBubble } from "./MessageBubble";
import { MessageStream } from "./MessageStream";
import type { ChatMessage } from "@/types/api";

interface ChatSurfaceProps {
  messages: ChatMessage[];
  streamingText: string;
  loading: boolean;
  loadingHint: string | null;
  userName?: string;
}

/**
 * ChatSurface — render del thread completo de mensajes.
 *
 * Si messages=[] y !loading → ChatEmpty (greeting Gemini-style).
 * Si messages.length > 0 → list de MessageBubble + MessageStream activo si streaming.
 *
 * Auto-scroll: pegado al bottom cuando llegan nuevos messages o streaming text.
 */
export function ChatSurface({
  messages,
  streamingText,
  loading,
  loadingHint,
  userName,
}: ChatSurfaceProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll a bottom
  useEffect(() => {
    if (!bottomRef.current) return;
    const behavior: ScrollBehavior = messages.length === 0 ? "auto" : "smooth";
    bottomRef.current.scrollIntoView({ behavior, block: "end" });
  }, [messages.length, streamingText, loading]);

  const isEmpty = messages.length === 0 && !streamingText && !loading;

  if (isEmpty) {
    return <ChatEmpty userName={userName} />;
  }

  return (
    <div ref={scrollRef} className="flex flex-col h-full overflow-y-auto">
      {/*
        P1-10 audit fix: role="log" + aria-live="polite" para que lectores de
        pantalla anuncien los mensajes nuevos de Noa. polite no interrumpe lo
        que está leyendo el usuario; cuando finaliza el assistant msg el SR
        lo anuncia. El stream live no se anuncia token-a-token (sería ruidoso);
        el hint contextual va en un live region aparte sr-only.
      */}
      <div
        className="mx-auto max-w-3xl w-full py-4"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Conversación con Noa"
      >
        {messages.map((msg, i) => {
          const prev = messages[i - 1];
          const showAvatar = !prev || prev.role !== msg.role;
          return <MessageBubble key={msg.id} message={msg} showAvatar={showAvatar} />;
        })}

        {(loading || streamingText) && (
          <MessageStream streamingText={streamingText} hint={loadingHint} />
        )}

        <div ref={bottomRef} className="h-2" />
      </div>

      {/* Live region sr-only para anunciar estado de carga sin spammar token a token */}
      <div role="status" aria-live="polite" className="sr-only">
        {loading && !streamingText ? (loadingHint ?? "Pensando…") : ""}
      </div>
    </div>
  );
}
