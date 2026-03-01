import { useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import type { Message } from "../hooks/useChat";

interface Props {
  message: Message;
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
      className="sm:opacity-0 sm:group-hover:opacity-100 opacity-50 transition-opacity p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-gray-400"
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

export function MessageBubble({ message }: Props) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-2 animate-bubble-in group`}>
      <div
        className={`max-w-[85%] rounded-[18px] px-3.5 py-2 relative ${
          isUser
            ? "bg-gradient-to-br from-[#572c77] to-[#7c4d9e] text-white rounded-br-[4px] shadow-sm shadow-[#572c77]/20"
            : "bg-[#f5f3f7] dark:bg-[#1e1b22] text-gray-900 dark:text-gray-100 rounded-bl-[4px]"
        }`}
      >
        {!isUser && (
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[11px] font-bold text-[#bcd431]">
              {message.agent === "kira" ? "Kira" : "Kronos"}
            </span>
            <CopyButton text={message.content} />
          </div>
        )}
        {message.image && (
          <img
            src={`data:image/jpeg;base64,${message.image}`}
            alt="Imagen adjunta"
            className="rounded-xl max-h-52 w-auto mb-1.5 cursor-pointer"
            onClick={() => {
              const win = window.open();
              if (win) {
                win.document.write(`<img src="data:image/jpeg;base64,${message.image}" style="max-width:100%;height:auto">`);
              }
            }}
          />
        )}
        {isUser ? (
          message.content && message.content !== "[Imagen]" ? (
            <p className="text-[15px] leading-snug whitespace-pre-wrap">{message.content}</p>
          ) : null
        ) : (
          <div className="text-[15px] leading-snug prose prose-sm dark:prose-invert max-w-none [&>p]:mb-1.5 [&>p:last-child]:mb-0 [&>ul]:mb-1.5 [&>ol]:mb-1.5">
            <ReactMarkdown rehypePlugins={[rehypeHighlight]}>{message.content}</ReactMarkdown>
          </div>
        )}
        <span className={`text-[10px] block text-right mt-0.5 ${isUser ? "text-white/50" : "text-gray-400 dark:text-gray-500"}`}>
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
    <div className="flex justify-start mb-2 animate-bubble-in">
      <div className="max-w-[85%] rounded-[18px] px-3.5 py-2 rounded-bl-[4px] bg-[#f5f3f7] dark:bg-[#1e1b22]">
        <span className="text-[11px] font-bold block mb-0.5 text-[#bcd431]">
          {agent === "kira" ? "Kira" : "Kronos"}
        </span>
        <div className="text-[15px] leading-snug prose prose-sm dark:prose-invert max-w-none text-gray-900 dark:text-gray-100">
          <ReactMarkdown rehypePlugins={[rehypeHighlight]}>{text}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
