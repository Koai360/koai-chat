import { useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import type { Message } from "@/hooks/useChat";
import { motion } from "framer-motion";
import { AIStarIcon } from "@/components/shared/AIStarIcon";
import { MessageActions } from "./MessageActions";

interface Props {
  message: Message;
  onImageClick?: (src: string) => void;
  isLast?: boolean;
  onRegenerate?: () => void;
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
    <div className="relative group/code my-2">
      <div className="flex items-center justify-between px-3 py-1.5 rounded-t-lg border border-b-0 bg-bg-sidebar border-border">
        <span className="text-[10px] font-mono text-text-muted uppercase">{lang || "code"}</span>
        <button
          onClick={handleCopy}
          className="text-[10px] text-text-muted hover:text-text px-2 py-0.5 rounded transition-colors"
        >
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
      <code className={`${className} !rounded-t-none !mt-0 !border-t-0`}>{children}</code>
    </div>
  );
}

function ImageBlock({ image, isUser, onImageClick }: { image: string; isUser: boolean; onImageClick?: (src: string) => void }) {
  const isUrl = image.startsWith("http://") || image.startsWith("https://");
  const src = isUrl
    ? image
    : `data:${image.startsWith("iVBOR") ? "image/png" : image.startsWith("R0lGOD") ? "image/gif" : image.startsWith("UklGR") ? "image/webp" : "image/jpeg"};base64,${image}`;
  return (
    <img
      src={src}
      alt={isUser ? "Adjunta" : "Generada"}
      className={`rounded-xl w-auto mb-2 cursor-pointer transition-transform hover:scale-[1.02] border border-border ${isUser ? "max-h-52" : "max-h-80"}`}
      onClick={() => onImageClick?.(src)}
    />
  );
}

export function MessageBubble({ message, onImageClick, isLast, onRegenerate }: Props) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col items-end px-4 mb-3 group/msg"
      >
        <div className="max-w-[85%] md:max-w-[70%] ml-auto bg-bg-surface border border-border rounded-2xl px-4 py-3">
          {message.image && <ImageBlock image={message.image} isUser onImageClick={onImageClick} />}
          {message.content && message.content !== "[Imagen]" && (
            <p className="text-[15px] leading-[1.4] text-text whitespace-pre-wrap">
              {message.content}
            </p>
          )}
        </div>
        <span className="text-[10px] mt-1 mr-1 text-text-muted opacity-0 group-hover/msg:opacity-100 transition-opacity">
          {new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex items-start gap-3 px-4 mb-3 group/msg"
    >
      {/* AI Star Icon */}
      <div className="flex-shrink-0 mt-0.5">
        <AIStarIcon size="sm" />
      </div>

      <div className="flex-1 min-w-0 flex flex-col">
        {message.image && <ImageBlock image={message.image} isUser={false} onImageClick={onImageClick} />}
        <div
          className="text-[15px] leading-[1.55] prose prose-sm prose-invert max-w-none
            [&>p]:mb-2 [&>p:last-child]:mb-0 [&>ul]:mb-2 [&>ol]:mb-2
            [&_pre]:rounded-b-lg text-text"
        >
          <ReactMarkdown
            rehypePlugins={[rehypeHighlight]}
            components={{
              code({ className, children }) {
                const isBlock = className?.startsWith("hljs") || className?.startsWith("language-");
                if (isBlock) return <CodeBlock className={className}>{String(children)}</CodeBlock>;
                return (
                  <code className="px-1.5 py-0.5 rounded text-[13px] font-mono bg-bg-surface">
                    {children}
                  </code>
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
        />

        <span className="text-[10px] text-text-muted opacity-0 group-hover/msg:opacity-100 transition-opacity mt-0.5">
          {new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </motion.div>
  );
}

export function StreamingBubble({ text, agent: _agent }: { text: string; agent: "kira" | "kronos" }) {
  if (!text) return null;

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
      <div className="flex-1 min-w-0">
        <div className="text-[15px] leading-[1.55] prose prose-sm prose-invert max-w-none text-text">
          <ReactMarkdown rehypePlugins={[rehypeHighlight]}>{text}</ReactMarkdown>
          <span className="inline-block w-1.5 h-4 animate-pulse ml-0.5 -mb-0.5 rounded-sm opacity-70 bg-text-muted" />
        </div>
      </div>
    </motion.div>
  );
}
