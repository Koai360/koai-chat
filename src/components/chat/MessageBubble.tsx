import { memo, useState } from "react";
import { AnimatePresence } from "framer-motion";
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

  // Assistant: parsear card markers
  const segments = parseCards(message.content);

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
      </div>
      <AnimatePresence>
        {lightboxUrl && (
          <ImageLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
        )}
      </AnimatePresence>
    </div>
  );
});
