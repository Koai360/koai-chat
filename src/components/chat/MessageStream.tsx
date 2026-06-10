import { Sparkle } from "./Sparkle";
import { parseCards } from "@/lib/cards";
import { CardRenderer } from "./CardRenderer";
import { LazyNoaMarkdown as NoaMarkdown } from "./LazyNoaMarkdown";

interface MessageStreamProps {
  streamingText: string;
  hint?: string | null;
}

/**
 * MessageStream — burbuja efímera para el streaming text que aún no se
 * promueve a `ChatMessage` (mientras llega el done event).
 *
 * Muestra:
 *   - Sparkle pulsando
 *   - Hint contextual ("Pensando…", "Consultando cash flow…")
 *   - Texto streaming con markdown (mismo rendering que MessageBubble final)
 *   - Cards inline si ya hay markers parseables
 *
 * P2-2 audit: comparte NoaMarkdown con MessageBubble — no más flash al promover.
 */
export function MessageStream({ streamingText, hint }: MessageStreamProps) {
  const segments = streamingText ? parseCards(streamingText) : [];

  return (
    <div className="flex gap-3 px-4 md:px-6 py-2">
      <div className="shrink-0 mt-1">
        <Sparkle size={22} animate />
      </div>
      <div className="flex-1 min-w-0 space-y-3">
        {!streamingText && hint && (
          <div className="text-sm text-white/55 italic">{hint}</div>
        )}
        {segments.map((seg, i) =>
          seg.kind === "text" ? (
            <div
              key={i}
              className="prose-noa text-white/95 text-[15px] leading-[1.65]"
            >
              <NoaMarkdown content={seg.content} />
            </div>
          ) : (
            <CardRenderer key={i} card={seg.card} />
          ),
        )}
      </div>
    </div>
  );
}
