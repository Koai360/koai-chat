import { useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import type { Message } from "@/hooks/useChat";
import { AgentAvatar } from "@/components/shared/AgentAvatar";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Copy, Check, RefreshCw } from "lucide-react";

interface Props {
  message: Message;
  onImageClick?: (src: string) => void;
  isLast?: boolean;
  onRegenerate?: () => void;
}

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
    <button onClick={handleCopy} className="opacity-0 group-hover/msg:opacity-100 transition-opacity p-1 rounded hover:bg-white/5 text-text-muted" title="Copiar">
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
      <div className="flex items-center justify-between px-3 py-1.5 bg-bg-sidebar rounded-t-lg border border-border-subtle border-b-0">
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
  const mime = image.startsWith("iVBOR") ? "image/png" : image.startsWith("R0lGOD") ? "image/gif" : image.startsWith("UklGR") ? "image/webp" : "image/jpeg";
  const src = `data:${mime};base64,${image}`;
  return (
    <img
      src={src}
      alt={isUser ? "Adjunta" : "Generada"}
      className={`rounded-xl w-auto mb-2 cursor-pointer border border-border-subtle transition-transform hover:scale-[1.02] ${isUser ? "max-h-52" : "max-h-80"}`}
      onClick={() => onImageClick?.(src)}
    />
  );
}

export function MessageBubble({ message, onImageClick, isLast, onRegenerate }: Props) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-end mb-4 group/msg"
      >
        <div className="max-w-[85%]">
          <div className="rounded-2xl rounded-br-md px-4 py-2.5 bg-brand text-white">
            {message.image && <ImageBlock image={message.image} isUser onImageClick={onImageClick} />}
            {message.content && message.content !== "[Imagen]" && (
              <p className="text-[15px] leading-snug whitespace-pre-wrap">{message.content}</p>
            )}
          </div>
          <span className="text-[10px] block text-right mt-0.5 text-text-muted/40 opacity-0 group-hover/msg:opacity-100 transition-opacity">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      </motion.div>
    );
  }

  const agentColor = message.agent === "kronos" ? "text-kronos" : "text-kira";
  const agentLabel = message.agent === "kronos" ? "Kronos" : "Kira";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-2.5 mb-4 group/msg"
    >
      <AgentAvatar agent={message.agent || "kira"} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="outline" className={`text-[10px] h-4 px-1.5 border-0 bg-transparent font-semibold ${agentColor}`}>
            {agentLabel}
          </Badge>
        </div>
        {message.image && <ImageBlock image={message.image} isUser={false} onImageClick={onImageClick} />}
        <div className="text-[15px] leading-relaxed prose prose-sm prose-invert max-w-none [&>p]:mb-2 [&>p:last-child]:mb-0 [&>ul]:mb-2 [&>ol]:mb-2 [&_pre]:rounded-b-lg [&_pre]:bg-bg-sidebar [&_pre]:border [&_pre]:border-border-subtle text-text">
          <ReactMarkdown
            rehypePlugins={[rehypeHighlight]}
            components={{
              code({ className, children }) {
                const isBlock = className?.startsWith("hljs") || className?.startsWith("language-");
                if (isBlock) return <CodeBlock className={className}>{String(children)}</CodeBlock>;
                return <code className="px-1.5 py-0.5 rounded bg-bg-surface text-[13px] font-mono">{children}</code>;
              },
            }}
          >{message.content}</ReactMarkdown>
        </div>
        <div className="flex items-center gap-2 mt-1 opacity-0 group-hover/msg:opacity-100 transition-opacity">
          <CopyButton text={message.content} />
          {isLast && onRegenerate && (
            <button onClick={onRegenerate} className="p-1 rounded hover:bg-white/5 text-text-muted" title="Regenerar">
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          )}
          <span className="text-[10px] text-text-muted/40">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

export function StreamingBubble({ text, agent }: { text: string; agent: "kira" | "kronos" }) {
  if (!text) return null;
  const agentColor = agent === "kronos" ? "text-kronos" : "text-kira";
  const agentLabel = agent === "kronos" ? "Kronos" : "Kira";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-2.5 mb-4"
    >
      <AgentAvatar agent={agent} size="sm" />
      <div className="flex-1 min-w-0">
        <Badge variant="outline" className={`text-[10px] h-4 px-1.5 border-0 bg-transparent font-semibold mb-1 ${agentColor}`}>
          {agentLabel}
        </Badge>
        <div className="text-[15px] leading-relaxed prose prose-sm prose-invert max-w-none text-text">
          <ReactMarkdown rehypePlugins={[rehypeHighlight]}>{text}</ReactMarkdown>
          <span className="inline-block w-1.5 h-4 bg-current animate-pulse ml-0.5 -mb-0.5 rounded-sm opacity-60" />
        </div>
      </div>
    </motion.div>
  );
}
