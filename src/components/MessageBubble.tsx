import { useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import type { Message } from "../hooks/useChat";

interface Props {
  message: Message;
  onImageClick?: (src: string) => void;
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
    <button
      onClick={handleCopy}
      className="sm:opacity-0 sm:group-hover:opacity-100 opacity-50 transition-opacity p-1 rounded-md hover:bg-white/5 text-[#9b9b9b]"
      title="Copiar"
    >
      {copied ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  );
}

function AgentAvatar({ agent }: { agent?: string }) {
  const src = agent === "kronos" ? "/icons/kronos-logo.svg" : "/icons/kira-logo.svg";
  return (
    <img
      src={src}
      alt={agent === "kronos" ? "Kronos" : "Kira"}
      className="w-6 h-6 rounded-full flex-shrink-0 mt-0.5"
    />
  );
}

function ImageBlock({ image, isUser, onImageClick }: { image: string; isUser: boolean; onImageClick?: (src: string) => void }) {
  const mime = image.startsWith("iVBOR") ? "image/png"
    : image.startsWith("R0lGOD") ? "image/gif"
    : image.startsWith("UklGR") ? "image/webp"
    : "image/jpeg";
  const src = `data:${mime};base64,${image}`;
  return (
    <img
      src={src}
      alt={isUser ? "Imagen adjunta" : "Imagen generada"}
      className={`rounded-2xl w-auto mb-1.5 cursor-pointer border border-white/[0.06] transition-transform duration-300 hover:scale-[1.02] ${isUser ? "max-h-52" : "max-h-80"}`}
      onClick={() => onImageClick?.(src)}
    />
  );
}

export function MessageBubble({ message, onImageClick }: Props) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end mb-3 animate-bubble-in group">
        <div className="max-w-[85%] rounded-3xl px-4 py-2.5 bg-[#2f2f2f] text-[#ececec]">
          {message.image && (
            <ImageBlock image={message.image} isUser onImageClick={onImageClick} />
          )}
          {message.content && message.content !== "[Imagen]" && (
            <p className="text-[15px] leading-snug whitespace-pre-wrap">{message.content}</p>
          )}
          <span className="text-[10px] block text-right mt-0.5 text-[#9b9b9b]/60">
            {new Date(message.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      </div>
    );
  }

  // Assistant — no bubble, text flows on background
  return (
    <div className="flex gap-2.5 mb-3 animate-bubble-in group">
      <AgentAvatar agent={message.agent} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[11px] font-semibold text-[#bcd431]">
            {message.agent === "kira" ? "Kira" : "Kronos"}
          </span>
          <CopyButton text={message.content} />
        </div>
        {message.image && (
          <ImageBlock image={message.image} isUser={false} onImageClick={onImageClick} />
        )}
        <div className="text-[15px] leading-relaxed prose prose-sm prose-invert max-w-none [&>p]:mb-1.5 [&>p:last-child]:mb-0 [&>ul]:mb-1.5 [&>ol]:mb-1.5 text-[#ececec]">
          <ReactMarkdown rehypePlugins={[rehypeHighlight]}>{message.content}</ReactMarkdown>
        </div>
        <span className="text-[10px] block mt-1 text-[#9b9b9b]/60">
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  );
}

export function StreamingBubble({ text, agent }: { text: string; agent: "kira" | "kronos" }) {
  if (!text) return null;
  return (
    <div className="flex gap-2.5 mb-3 animate-bubble-in">
      <AgentAvatar agent={agent} />
      <div className="flex-1 min-w-0">
        <span className="text-[11px] font-semibold block mb-0.5 text-[#bcd431]">
          {agent === "kira" ? "Kira" : "Kronos"}
        </span>
        <div className="text-[15px] leading-relaxed prose prose-sm prose-invert max-w-none text-[#ececec]">
          <ReactMarkdown rehypePlugins={[rehypeHighlight]}>{text}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
