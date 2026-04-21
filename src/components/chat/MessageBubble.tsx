import { useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import type { Message } from "@/hooks/useChat";
import { motion } from "framer-motion";
import { AIStarIcon } from "@/components/shared/AIStarIcon";
import { MessageActions } from "./MessageActions";
import { ImageMetadataBadge } from "./ImageMetadataBadge";
import { sendMessageFeedback } from "@/lib/api";
import { getCfTransformUrl } from "@/lib/cfTransform";

interface Props {
  message: Message;
  conversationId?: string;
  onImageClick?: (src: string, messageId?: string) => void;
  onEditImage?: (imageUrl: string) => void;
  onAnimateImage?: (imageUrl: string) => void;
  isLast?: boolean;
  onRegenerate?: () => void;
  /** True si es el primer mensaje de ESTE agente en el thread (run de consecutivos).
      Controla si se muestra AIStarIcon completo (brand moment) o un dot lime/cyan
      como continuación. Reduce ruido visual en threads largos. */
  isFirstOfAgentRun?: boolean;
  /** True si el siguiente mensaje tiene imagen o code block (ritmo vertical variable). */
  hasDenseFollowing?: boolean;
}

/**
 * AgentMark — avatar del assistant. Estrella completa (brand moment) en el primer
 * mensaje de un run del mismo agente, dot colored en los siguientes.
 */
function AgentMark({ agent, isFirst }: { agent?: "noa" | "kronos"; isFirst: boolean }) {
  if (isFirst) {
    return <AIStarIcon size="sm" />;
  }
  const color = agent === "kronos" ? "#00E5FF" : "#D4E94B";
  const glow = agent === "kronos" ? "rgba(0,229,255,0.35)" : "rgba(212,233,75,0.35)";
  return (
    <div className="w-6 h-6 flex items-center justify-center">
      <div
        className="w-2 h-2 rounded-full"
        style={{
          backgroundColor: color,
          boxShadow: `0 0 6px ${glow}`,
        }}
      />
    </div>
  );
}

function CodeBlock({ children, className }: { children: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const code = String(children).replace(/\n$/, "");
  const lang = className?.replace(/^(language-|hljs )/, "").split(" ")[0] || "";
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [code]);

  return (
    <div
      className="relative group/code my-2 rounded-lg overflow-hidden"
      style={{
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04), 0 1px 0 rgba(0,0,0,0.25)",
      }}
    >
      <div
        className="flex items-center justify-between px-3 py-1.5 bg-bg-sidebar border-b border-border"
      >
        <span className="text-[10px] font-mono text-text-muted uppercase tracking-wider">{lang || "code"}</span>
        <button
          onClick={handleCopy}
          className="text-[11px] text-text-muted hover:text-text px-2 py-0.5 rounded transition-colors"
        >
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
      <code className={`${className} !rounded-none !mt-0 !border-0 block`}>{children}</code>
    </div>
  );
}

function ImageBlock({
  image,
  messageId,
  isUser,
  onImageClick,
  onEditImage,
  onAnimateImage,
}: {
  image: string;
  messageId?: string;
  isUser: boolean;
  onImageClick?: (src: string, messageId?: string) => void;
  onEditImage?: (imageUrl: string) => void;
  onAnimateImage?: (imageUrl: string) => void;
}) {
  const isUrl = image.startsWith("http://") || image.startsWith("https://");
  // Para URLs R2: usar CF Transform preview (1200px, format=auto) → mobile friendly
  // Para base64 legacy: construir data URI
  const displaySrc = isUrl
    ? getCfTransformUrl(image, "preview")
    : `data:${image.startsWith("iVBOR") ? "image/png" : image.startsWith("R0lGOD") ? "image/gif" : image.startsWith("UklGR") ? "image/webp" : "image/jpeg"};base64,${image}`;
  // La URL que se pasa al viewer y al edit es la ORIGINAL (sin transformar)
  const originalSrc = isUrl ? image : displaySrc;
  // Edit/animate solo disponible para URLs R2 (no base64 legacy) y mensajes de Noa
  const canEdit = isUrl && !isUser && onEditImage;
  const canAnimate = isUrl && !isUser && onAnimateImage;

  return (
    <div className="relative group/img mb-2 inline-block">
      <img
        src={displaySrc}
        alt={isUser ? "Adjunta" : "Generada"}
        className={`rounded-xl w-auto cursor-pointer transition-transform hover:scale-[1.02] border border-border ${isUser ? "max-h-52" : "max-h-80"}`}
        onClick={() => onImageClick?.(originalSrc, messageId)}
        loading="lazy"
        decoding="async"
      />
      {(canEdit || canAnimate) && (
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover/img:opacity-100 active:opacity-100 transition-opacity">
          {canAnimate && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(8);
                onAnimateImage(originalSrc);
              }}
              className="px-2.5 py-1.5 bg-black/70 backdrop-blur-sm border border-white/15 rounded-lg text-[11px] font-medium text-white flex items-center gap-1"
              aria-label="Animar esta imagen con Wan2.1"
            >
              <span className="text-[#7DD3FC]">▶</span>
              Animar
            </button>
          )}
          {canEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(8);
                onEditImage(originalSrc);
              }}
              className="px-2.5 py-1.5 bg-black/70 backdrop-blur-sm border border-white/15 rounded-lg text-[11px] font-medium text-white flex items-center gap-1"
              aria-label="Editar esta imagen con Kontext"
            >
              <span className="text-[#E5A3F0]">✎</span>
              Editar
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function MessageBubble({ message, conversationId, onImageClick, onEditImage, onAnimateImage, isLast, onRegenerate, isFirstOfAgentRun = true, hasDenseFollowing = false }: Props) {
  const isUser = message.role === "user";
  // Ritmo vertical: respiración extra tras mensajes densos (code/imagen) o cuando
  // el siguiente mensaje tiene contenido denso.
  const hasImage = !!message.image;
  const hasCode = typeof message.content === "string" && message.content.includes("```");
  const needsBreath = hasImage || hasCode || hasDenseFollowing;
  const marginBottom = needsBreath ? "mb-5" : "mb-3";

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20, filter: "blur(4px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.3 }}
        className={`flex flex-col items-end px-4 ${marginBottom} group/msg`}
      >
        {/* Mark + timestamp arriba — transcript style, no bubble */}
        <div className="flex items-center gap-1.5 mb-1 mr-1">
          <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-text-subtle">
            Tú
          </span>
          <span className="font-mono text-[10px] text-text-subtle tabular-nums timestamp-on-hover opacity-50 group-hover/msg:opacity-90 transition-opacity">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
        <div
          className="max-w-[85%] md:max-w-[70%] ml-auto px-4 py-3 rounded-2xl bg-bg-surface/60"
          style={{
            borderRight: "2px solid rgba(212, 233, 75, 0.25)",
          }}
        >
          {message.image && <ImageBlock image={message.image} messageId={message.id} isUser onImageClick={onImageClick} onEditImage={onEditImage} onAnimateImage={onAnimateImage} />}
          {message.content && message.content !== "[Imagen]" && (
            <p className="text-[15px] leading-[1.45] text-text whitespace-pre-wrap">
              {message.content}
            </p>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.35 }}
      className={`flex items-start gap-3 px-4 ${marginBottom} group/msg`}
    >
      {/* Agent mark — estrella completa primera vez, dot en continuación */}
      <div className="flex-shrink-0 mt-0.5">
        <AgentMark agent={message.agent} isFirst={isFirstOfAgentRun} />
      </div>

      <div className="flex-1 min-w-0 flex flex-col">
        {message.image && (
          <div className="mb-2">
            <ImageBlock image={message.image} messageId={message.id} isUser={false} onImageClick={onImageClick} onEditImage={onEditImage} onAnimateImage={onAnimateImage} />
            {message.imageMetadata && (
              <div className="mt-1.5">
                <ImageMetadataBadge
                  engine={message.imageMetadata.engine}
                  generationTimeMs={message.imageMetadata.generationTimeMs}
                  costEstimateUsd={message.imageMetadata.costEstimateUsd}
                />
              </div>
            )}
          </div>
        )}
        <div
          className="text-[16px] leading-[1.6] prose prose-sm prose-invert max-w-none
            [&>p]:mb-2 [&>p:last-child]:mb-0 [&>ul]:mb-2 [&>ol]:mb-2
            [&_pre]:rounded-b-lg text-text border-l-2 pl-3"
          style={{
            borderLeftColor: message.agent === "kronos"
              ? "rgba(0, 229, 255, 0.25)"
              : "rgba(197, 227, 74, 0.25)",
          }}
        >
          <ReactMarkdown
            rehypePlugins={[rehypeHighlight]}
            components={{
              code({ className, children }) {
                const isBlock = className?.startsWith("hljs") || className?.startsWith("language-");
                if (isBlock) return <CodeBlock className={className}>{String(children)}</CodeBlock>;
                return (
                  <code className="px-1.5 py-0.5 rounded text-[14px] font-mono bg-bg-surface">
                    {children}
                  </code>
                );
              },
              img({ src }) {
                if (!src) return null;
                return (
                  <ImageBlock
                    image={src}
                    messageId={message.id}
                    isUser={false}
                    onImageClick={onImageClick}
                    onEditImage={onEditImage}
                    onAnimateImage={onAnimateImage}
                  />
                );
              },
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>

        {/* Message Actions */}
        <MessageActions
          isLast={isLast}
          onRegenerate={onRegenerate}
          onCopy={() => navigator.clipboard.writeText(message.content)}
          onThumbsUp={() => {
            if (conversationId) {
              sendMessageFeedback({
                message_id: message.id,
                conversation_id: conversationId,
                rating: "up",
                message_content: message.content.slice(0, 500),
                agent: message.agent,
              });
            }
          }}
          onThumbsDown={() => {
            if (conversationId) {
              sendMessageFeedback({
                message_id: message.id,
                conversation_id: conversationId,
                rating: "down",
                message_content: message.content.slice(0, 500),
                agent: message.agent,
              });
            }
          }}
        />

        <span className="text-[11px] text-text-muted timestamp-on-hover opacity-0 group-hover/msg:opacity-100 transition-opacity mt-0.5">
          {new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </motion.div>
  );
}

export function StreamingBubble({ text, agent }: { text: string; agent: "noa" | "kronos" }) {
  if (!text) return null;
  const borderColor = agent === "kronos" ? "rgba(0, 229, 255, 0.25)" : "rgba(197, 227, 74, 0.25)";
  // R13: gradient signature purple→lime (Noa) o purple→cyan (Kronos) en el cursor
  // de streaming — brand moment durante "Noa está escribiendo".
  const cursorGradient = agent === "kronos"
    ? "linear-gradient(180deg, #7B2D8E 0%, #00E5FF 100%)"
    : "linear-gradient(180deg, #7B2D8E 0%, #D4E94B 100%)";
  const cursorGlow = agent === "kronos" ? "rgba(0,229,255,0.5)" : "rgba(212,233,75,0.5)";

  // Mismo wrapper / border / padding que MessageBubble assistant para que no
  // haya "salto" visual al terminar el stream (solo gana MessageActions).
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex items-start gap-3 px-4 mb-3"
    >
      <div className="flex-shrink-0 mt-0.5">
        <AIStarIcon size="sm" />
      </div>
      <div className="flex-1 min-w-0 flex flex-col">
        <div
          className="text-[16px] leading-[1.6] prose prose-sm prose-invert max-w-none
            [&>p]:mb-2 [&>p:last-child]:mb-0 [&>ul]:mb-2 [&>ol]:mb-2
            [&_pre]:rounded-b-lg text-text border-l-2 pl-3"
          style={{ borderLeftColor: borderColor }}
        >
          <ReactMarkdown rehypePlugins={[rehypeHighlight]}>{text}</ReactMarkdown>
          <span
            className="inline-block w-[4px] h-[18px] animate-pulse ml-0.5 -mb-0.5 rounded-[2px] align-middle"
            style={{
              background: cursorGradient,
              boxShadow: `0 0 10px ${cursorGlow}`,
            }}
          />
        </div>
      </div>
    </motion.div>
  );
}
