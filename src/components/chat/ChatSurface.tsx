import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
  /** S158-b: error al cargar mensajes de la conversación (antes fallaba en silencio) */
  loadError?: boolean;
  onRetryLoad?: () => void;
}

/** Mensajes visibles inicialmente — conversaciones largas se renderizaban
 *  COMPLETAS (cientos de burbujas + markdown) congelando la apertura (S158-b). */
const VISIBLE_BATCH = 50;

/**
 * ChatSurface — render del thread completo de mensajes.
 *
 * Si messages=[] y !loading → ChatEmpty (greeting Gemini-style).
 * Si messages.length > 0 → list de MessageBubble + MessageStream activo si streaming.
 *
 * Auto-scroll S158-b: SOLO si el usuario está pegado al fondo (pinned). Antes
 * cada token forzaba scrollIntoView y era imposible leer hacia arriba mientras
 * Noa respondía. Cambio de conversación → salto instantáneo (sin animar todo
 * el historial); mensajes nuevos en la misma conv → smooth.
 */
export function ChatSurface({
  messages,
  streamingText,
  loading,
  loadingHint,
  userName,
  loadError = false,
  onRetryLoad,
}: ChatSurfaceProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);
  const lastConvRef = useRef<string | null>(null);
  const prevHeightRef = useRef<number | null>(null);
  const [visibleCount, setVisibleCount] = useState(VISIBLE_BATCH);

  const convId = messages[0]?.conversation_id ?? null;
  const lastMsg = messages[messages.length - 1];

  // Reset del slice al cambiar de conversación
  useEffect(() => {
    setVisibleCount(VISIBLE_BATCH);
  }, [convId]);

  // Track pinned-to-bottom: el usuario decide si está "siguiendo" el stream
  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  // "Ver anteriores" sin salto: preservar el scroll offset al prepender
  const showOlder = () => {
    prevHeightRef.current = scrollRef.current?.scrollHeight ?? null;
    setVisibleCount((c) => c + 100);
  };
  useLayoutEffect(() => {
    if (prevHeightRef.current != null && scrollRef.current) {
      const delta = scrollRef.current.scrollHeight - prevHeightRef.current;
      scrollRef.current.scrollTop += delta;
      prevHeightRef.current = null;
    }
  }, [visibleCount]);

  // Auto-scroll a bottom (con guard de posición)
  useEffect(() => {
    if (!bottomRef.current) return;
    const isConvChange = lastConvRef.current !== convId;
    if (isConvChange) {
      lastConvRef.current = convId;
      pinnedRef.current = true;
      // Carga inicial / cambio de conv: salto instantáneo, NO animar por todo
      // el historial (jank de segundos en conversaciones largas)
      bottomRef.current.scrollIntoView({ behavior: "auto", block: "end" });
      return;
    }
    // Mensaje propio recién enviado → siempre re-pin (el usuario espera verlo)
    if (lastMsg?.role === "user") pinnedRef.current = true;
    if (!pinnedRef.current) return; // el usuario está leyendo arriba — no pelear
    // Streaming: instantáneo (smooth acumulado por token = mareo); smooth solo
    // para mensajes completos nuevos
    const behavior: ScrollBehavior = streamingText ? "auto" : "smooth";
    bottomRef.current.scrollIntoView({ behavior, block: "end" });
  }, [messages.length, streamingText, loading, convId, lastMsg?.role]);

  const isEmpty = messages.length === 0 && !streamingText && !loading;

  if (isEmpty && loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
        <p className="text-white/75 text-[15px]">No se pudo cargar la conversación.</p>
        <p className="text-white/45 text-[13px]">Revisá tu conexión e intentá de nuevo.</p>
        {onRetryLoad && (
          <button
            onClick={onRetryLoad}
            className="mt-2 px-4 py-2 rounded-full bg-white/[0.08] hover:bg-white/[0.14] text-white/90 text-[14px] transition-colors"
          >
            Reintentar
          </button>
        )}
      </div>
    );
  }

  if (isEmpty) {
    return <ChatEmpty userName={userName} />;
  }

  const hiddenCount = Math.max(0, messages.length - visibleCount);
  const visibleMessages = hiddenCount > 0 ? messages.slice(hiddenCount) : messages;

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="flex flex-col h-full overflow-y-auto overscroll-y-contain"
    >
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
        {loadError && (
          <div className="mx-4 mb-3 flex items-center justify-between gap-3 rounded-xl bg-white/[0.05] border border-white/[0.10] px-4 py-2.5">
            <p className="text-[13px] text-white/70">No se pudieron actualizar los mensajes.</p>
            {onRetryLoad && (
              <button
                onClick={onRetryLoad}
                className="shrink-0 text-[13px] text-[var(--color-noa)] hover:underline"
              >
                Reintentar
              </button>
            )}
          </div>
        )}

        {hiddenCount > 0 && (
          <div className="flex justify-center mb-3">
            <button
              onClick={showOlder}
              className="px-4 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-white/65 text-[13px] transition-colors"
            >
              Ver {Math.min(hiddenCount, 100)} mensajes anteriores
            </button>
          </div>
        )}

        {visibleMessages.map((msg, i) => {
          const prev = visibleMessages[i - 1];
          const showAvatar = !prev || prev.role !== msg.role;
          return (
            <div key={msg.id} className="msg-cv">
              <MessageBubble message={msg} showAvatar={showAvatar} />
            </div>
          );
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
