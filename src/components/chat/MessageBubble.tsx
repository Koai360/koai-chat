import { useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import type { Message } from "@/hooks/useChat";
import { motion } from "framer-motion";
import { Copy, Check, RefreshCw } from "lucide-react";

interface Props {
  message: Message;
  onImageClick?: (src: string) => void;
  isLast?: boolean;
  onRegenerate?: () => void;
}

const AGENT_LIME = { kira: "#C5E34A", kronos: "#00E5FF" };
const AGENT_LABEL = { kira: "K", kronos: "Kr" };

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      onClick={handleCopy}
      className="opacity-0 group-hover/msg:opacity-100 transition-opacity p-1 rounded hover:bg-white/5 text-text-muted"
      title="Copiar"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-kira" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
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
    <div className="relative group/code my-2">
      <div
        className="flex items-center justify-between px-3 py-1.5 rounded-t-lg border border-b-0"
        style={{ backgroundColor: "#150827", borderColor: "rgba(91,45,140,0.30)" }}
      >
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
  // Soportar tanto URLs públicas como base64
  const isUrl = image.startsWith("http://") || image.startsWith("https://");
  const src = isUrl
    ? image
    : `data:${image.startsWith("iVBOR") ? "image/png" : image.startsWith("R0lGOD") ? "image/gif" : image.startsWith("UklGR") ? "image/webp" : "image/jpeg"};base64,${image}`;
  return (
    <img
      src={src}
      alt={isUser ? "Adjunta" : "Generada"}
      className={`rounded-xl w-auto mb-2 cursor-pointer transition-transform hover:scale-[1.02] ${isUser ? "max-h-52" : "max-h-80"}`}
      style={{ border: "1px solid rgba(91,45,140,0.30)" }}
      onClick={() => onImageClick?.(src)}
    />
  );
}

export function MessageBubble({ message, onImageClick, isLast, onRegenerate }: Props) {
  const isUser = message.role === "user";
  const agent = (message.agent || "kira") as "kira" | "kronos";
  const lime = AGENT_LIME[agent];

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col items-end px-4 mb-3 group/msg"
      >
        <div
          className="max-w-[80%] px-4 py-2.5 rounded-[20px]"
          style={{ backgroundColor: "rgba(197, 227, 74, 0.10)" }}
        >
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
      className="flex items-start gap-2.5 px-4 mb-3 group/msg"
    >
      {/* Avatar */}
      <div
        className="flex-shrink-0 w-7 h-7 mt-0.5 rounded-full flex items-center justify-center relative"
        style={{ backgroundColor: `${lime}1a` }}
      >
        <div
          className="absolute inset-0 rounded-full blur-md animate-pulse"
          style={{ backgroundColor: `${lime}4d` }}
        />
        <span className="relative text-[11px] font-medium" style={{ color: lime }}>
          {AGENT_LABEL[agent]}
        </span>
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
                  <code
                    className="px-1.5 py-0.5 rounded text-[13px] font-mono"
                    style={{ backgroundColor: "rgba(91,45,140,0.25)" }}
                  >
                    {children}
                  </code>
                );
              },
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <CopyButton text={message.content} />
          {isLast && onRegenerate && (
            <button
              onClick={onRegenerate}
              className="p-1 rounded hover:bg-white/5 text-text-muted opacity-0 group-hover/msg:opacity-100 transition-opacity"
              title="Regenerar"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          )}
          <span className="text-[10px] text-text-muted opacity-0 group-hover/msg:opacity-100 transition-opacity">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

export function StreamingBubble({ text, agent }: { text: string; agent: "kira" | "kronos" }) {
  if (!text) return null;
  const lime = AGENT_LIME[agent];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex items-start gap-2.5 px-4 mb-3"
    >
      <div
        className="flex-shrink-0 w-7 h-7 mt-0.5 rounded-full flex items-center justify-center relative"
        style={{ backgroundColor: `${lime}1a` }}
      >
        <div
          className="absolute inset-0 rounded-full blur-md animate-pulse"
          style={{ backgroundColor: `${lime}4d` }}
        />
        <span className="relative text-[11px] font-medium" style={{ color: lime }}>
          {AGENT_LABEL[agent]}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[15px] leading-[1.55] prose prose-sm prose-invert max-w-none text-text">
          <ReactMarkdown rehypePlugins={[rehypeHighlight]}>{text}</ReactMarkdown>
          <span
            className="inline-block w-1.5 h-4 animate-pulse ml-0.5 -mb-0.5 rounded-sm opacity-70"
            style={{ backgroundColor: lime }}
          />
        </div>
      </div>
    </motion.div>
  );
}
