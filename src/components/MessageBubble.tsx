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
      className="sm:opacity-0 sm:group-hover:opacity-100 opacity-60 transition-opacity p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
      title="Copiar"
    >
      {copied ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3 animate-bubble-in group`}>
      <div
        className={`max-w-[90%] sm:max-w-[85%] rounded-2xl px-3.5 sm:px-4 py-2.5 relative ${
          isUser
            ? "bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-br-md shadow-sm shadow-indigo-500/20"
            : message.agent === "kira"
              ? "bg-pink-50 dark:bg-pink-950/30 text-gray-900 dark:text-gray-100 rounded-bl-md"
              : "bg-indigo-50 dark:bg-indigo-950/30 text-gray-900 dark:text-gray-100 rounded-bl-md"
        }`}
      >
        {!isUser && (
          <div className="flex items-center justify-between mb-1">
            <span
              className={`text-xs font-semibold ${
                message.agent === "kira" ? "text-pink-500" : "text-indigo-500"
              }`}
            >
              {message.agent === "kira" ? "Kira" : "Kronos"}
            </span>
            <CopyButton text={message.content} />
          </div>
        )}
        {isUser ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none [&>p]:mb-2 [&>p:last-child]:mb-0 [&>ul]:mb-2 [&>ol]:mb-2">
            <ReactMarkdown rehypePlugins={[rehypeHighlight]}>{message.content}</ReactMarkdown>
          </div>
        )}
        <span className={`text-[10px] block text-right mt-1 ${isUser ? "text-white/60" : "opacity-40"}`}>
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
    <div className="flex justify-start mb-3 animate-bubble-in">
      <div
        className={`max-w-[90%] sm:max-w-[85%] rounded-2xl px-3.5 sm:px-4 py-2.5 rounded-bl-md ${
          agent === "kira"
            ? "bg-pink-50 dark:bg-pink-950/30"
            : "bg-indigo-50 dark:bg-indigo-950/30"
        }`}
      >
        <span
          className={`text-xs font-semibold block mb-1 ${
            agent === "kira" ? "text-pink-500" : "text-indigo-500"
          }`}
        >
          {agent === "kira" ? "Kira" : "Kronos"}
        </span>
        <div className="text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none text-gray-900 dark:text-gray-100">
          <ReactMarkdown rehypePlugins={[rehypeHighlight]}>{text}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
