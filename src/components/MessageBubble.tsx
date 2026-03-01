import ReactMarkdown from "react-markdown";
import type { Message } from "../hooks/useChat";

interface Props {
  message: Message;
}

export function MessageBubble({ message }: Props) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
          isUser
            ? "bg-indigo-500 text-white rounded-br-md"
            : message.agent === "kira"
              ? "bg-pink-50 dark:bg-pink-950/30 text-gray-900 dark:text-gray-100 rounded-bl-md"
              : "bg-indigo-50 dark:bg-indigo-950/30 text-gray-900 dark:text-gray-100 rounded-bl-md"
        }`}
      >
        {!isUser && (
          <span
            className={`text-xs font-semibold block mb-1 ${
              message.agent === "kira"
                ? "text-pink-500"
                : "text-indigo-500"
            }`}
          >
            {message.agent === "kira" ? "Kira" : "Kronos"}
          </span>
        )}
        {isUser ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none [&>p]:mb-2 [&>p:last-child]:mb-0 [&>ul]:mb-2 [&>ol]:mb-2">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
        <span className="text-[10px] opacity-50 block text-right mt-1">
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
    <div className="flex justify-start mb-3">
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 rounded-bl-md ${
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
          <ReactMarkdown>{text}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
