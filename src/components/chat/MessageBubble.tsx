import { memo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { Sparkle } from "./Sparkle";
import { CardRenderer } from "./CardRenderer";
import { LazyNoaMarkdown as NoaMarkdown } from "./LazyNoaMarkdown";
import { ImageLightbox } from "@/components/shared/ImageLightbox";
import { parseCards } from "@/lib/cards";
import { cfImageVariant } from "@/lib/imageTransform";
import { cn } from "@/lib/cn";
import type { ChatMessage } from "@/types/api";

interface MessageBubbleProps {
  message: ChatMessage;
  showAvatar: boolean;
}

export const MessageBubble = memo(function MessageBubble({
  message,
  showAvatar,
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  // S163: tap en imagen → lightbox con botón Descargar (share sheet iOS)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  if (isUser) {
    return (
      <div className="flex justify-end px-4 md:px-6 py-1.5">
        <div className="max-w-[80%]">
          <div className="bg-[var(--color-bg-elevated)] text-white rounded-2xl rounded-br-md px-4 py-2.5 text-[15px] leading-[1.55] border border-white/[0.06]">
            <NoaMarkdown content={message.content} plain />
          </div>
          {message.image && (
            <div className="mt-2 flex justify-end">
              <img
                src={cfImageVariant(message.image, 560)}
                alt=""
                loading="lazy"
                decoding="async"
                onClick={() => setLightboxUrl(message.image!)}
                className="block w-full max-w-[280px] h-auto rounded-xl border border-white/[0.06] cursor-zoom-in"
              />
            </div>
          )}
        </div>
        <AnimatePresence>
          {lightboxUrl && (
            <ImageLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
          )}
        </AnimatePresence>
      </div>
    );
  }

  // S242: aviso de estado (error / sin respuesta) — componente propio, NUNCA
  // markdown dentro de `message.content`. Así el aviso no puede quedar pegado
  // arriba de una respuesta que sí llegó: es su propia burbuja o no está.
  if (message.notice === "error" || message.notice === "silent") {
    return (
      <div className={cn("flex gap-3 px-4 md:px-6 py-2", !showAvatar && "pl-12 md:pl-14")}>
        {showAvatar && <div className="shrink-0 mt-1 w-[22px]" aria-hidden />}
        <div className="flex-1 min-w-0">
          <div
            role="status"
            className="inline-flex items-start gap-2 rounded-xl border border-amber-300/20 bg-amber-400/[0.07] px-3 py-2 text-[14px] leading-[1.5] text-amber-100/85"
          >
            <AlertTriangle size={15} className="shrink-0 mt-[3px] text-amber-300/80" />
            <span>{message.content}</span>
          </div>
        </div>
      </div>
    );
  }

  // S164: el modelo a veces incrusta la imagen generada TAMBIÉN como markdown
  // ![...](url) en su texto → se veía DOBLE en la burbuja (markdown + bloque
  // message.image). Si la URL coincide con message.image, sacarla del texto.
  const dedupedContent = message.image
    ? message.content.replace(
        /!\[[^\]]*\]\(\s*<?([^)\s]+)>?\s*\)/g,
        (full, url: string) => (url === message.image ? "" : full),
      )
    : message.content;

  // Assistant: parsear card markers
  const segments = parseCards(dedupedContent);

  return (
    <div className={cn("flex gap-3 px-4 md:px-6 py-2", !showAvatar && "pl-12 md:pl-14")}>
      {showAvatar && (
        <div className="shrink-0 mt-1">
          <Sparkle size={22} />
        </div>
      )}
      <div className="flex-1 min-w-0 space-y-3">
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
        {message.image && (
          /* S158-b: variante 960px (no el PNG original multi-MB), lazy, y
             aspect-ratio reservado → sin salto de layout al cargar (las
             generadas son ~95% cuadradas, mismo supuesto que GalleryPage) */
          <img
            src={cfImageVariant(message.image, 960)}
            alt=""
            loading="lazy"
            decoding="async"
            onClick={() => setLightboxUrl(message.image!)}
            style={
              message.image_width && message.image_height
                ? { aspectRatio: `${message.image_width} / ${message.image_height}` }
                : { aspectRatio: "1 / 1" }
            }
            className="block w-full max-w-[480px] h-auto rounded-xl border border-white/[0.06] object-cover cursor-zoom-in"
          />
        )}
        {/* S242: el turno escribió pero la conexión murió antes del `done`.
            La advertencia va AL PIE de su propia respuesta — el sondeo de
            reconciliación la reemplaza sola si el backend sí la persistió. */}
        {message.notice === "interrupted" && (
          <div className="flex items-center gap-1.5 text-[13px] leading-[1.4] text-amber-200/70">
            <AlertTriangle size={13} className="shrink-0" />
            <span>La conexión se cortó — puede faltar el final.</span>
          </div>
        )}
      </div>
      <AnimatePresence>
        {lightboxUrl && (
          <ImageLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
        )}
      </AnimatePresence>
    </div>
  );
});
