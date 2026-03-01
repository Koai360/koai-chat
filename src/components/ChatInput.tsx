import { useState, useRef, useEffect, useCallback } from "react";

interface Props {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}

export function ChatInput({ onSend, disabled, placeholder = "Escribe un mensaje...", autoFocus }: Props) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 120) + "px";
    }
  }, [text]);

  // Auto-focus when requested (e.g. conversation selected)
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      // Small delay to let layout settle after keyboard appears
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [autoFocus]);

  // Scroll input into view when keyboard opens
  const handleFocus = useCallback(() => {
    setTimeout(() => {
      textareaRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 300); // Wait for keyboard animation
  }, []);

  const handleSubmit = () => {
    if (!text.trim() || disabled) return;
    if (navigator.vibrate) navigator.vibrate(10);
    onSend(text);
    setText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const hasText = text.trim().length > 0;

  return (
    <div className="flex items-end gap-2 px-3 py-2 sm:p-3 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 safe-bottom">
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        inputMode="text"
        enterKeyHint="send"
        className="flex-1 resize-none rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 px-4 py-2.5 text-[16px] sm:text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-300 dark:focus:border-indigo-600 transition-all"
      />
      <button
        onClick={handleSubmit}
        disabled={disabled || !hasText}
        className={`flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-90 ${
          hasText && !disabled
            ? "bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-md shadow-indigo-500/30"
            : "bg-gray-100 dark:bg-gray-800 text-gray-400"
        }`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      </button>
    </div>
  );
}
