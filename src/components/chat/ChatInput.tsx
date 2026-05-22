import { forwardRef, useRef, useState, type KeyboardEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUp, Mic, Paperclip, Shield, Square } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { cn } from "@/lib/cn";

interface ChatInputProps {
  onSend: (text: string) => void;
  onStop?: () => void;
  onAttach?: () => void;
  onVoiceTap?: () => void;
  loading?: boolean;
  privateMode?: boolean;
  onTogglePrivate?: () => void;
  placeholder?: string;
}

/**
 * ChatInput — pill premium con icons + autogrow textarea.
 *
 * Layout (left to right):
 *   + (attach) · 🛡 (private mode toggle) · text · 🎤 (voice modal) · → (send)
 *
 * Send button SOLO visible si hay texto o loading. Si loading → Square (stop).
 *
 * Reglas:
 * - Min height 56 (mobile) / 60 (desktop)
 * - Max 6 líneas antes de scroll interno
 * - Enter envía, Shift+Enter newline
 * - Mobile: hide-on-keyboard removed (queremos input visible siempre)
 */
export const ChatInput = forwardRef<HTMLTextAreaElement, ChatInputProps>(
  (
    {
      onSend,
      onStop,
      onAttach,
      onVoiceTap,
      loading = false,
      privateMode = false,
      onTogglePrivate,
      placeholder = "Pregúntale a Noa",
    },
    ref,
  ) => {
    const [value, setValue] = useState("");
    const internalRef = useRef<HTMLTextAreaElement>(null);
    const textareaRef = (ref as React.RefObject<HTMLTextAreaElement>) ?? internalRef;

    const hasText = value.trim().length > 0;

    const adjustHeight = () => {
      const el = textareaRef.current;
      if (!el) return;
      el.style.height = "auto";
      const max = 160; // ~6 líneas
      el.style.height = `${Math.min(el.scrollHeight, max)}px`;
    };

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setValue(e.target.value);
      requestAnimationFrame(adjustHeight);
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    };

    const send = () => {
      const text = value.trim();
      if (!text || loading) return;
      onSend(text);
      setValue("");
      requestAnimationFrame(() => {
        if (textareaRef.current) textareaRef.current.style.height = "auto";
      });
    };

    return (
      <div className="px-3 md:px-6 pb-3 md:pb-5 safe-bottom">
        <div className="mx-auto max-w-3xl">
          <div
            className={cn(
              "flex items-end gap-1.5 px-2.5 py-2",
              "bg-[var(--color-bg-input)] border border-[var(--color-border-hi)]",
              "rounded-[26px] transition-all duration-200",
              "focus-within:border-[var(--color-noa)]/40 focus-within:shadow-[0_0_0_3px_var(--color-noa-soft)]",
            )}
          >
            {/* Attach */}
            {onAttach && (
              <IconButton
                icon={<Paperclip className="size-[18px]" />}
                label="Adjuntar archivo"
                variant="ghost"
                size="md"
                onClick={onAttach}
                className="shrink-0"
              />
            )}

            {/* Private mode toggle */}
            {onTogglePrivate && (
              <IconButton
                icon={<Shield className={cn("size-[18px]", privateMode && "text-[var(--color-noa)]")} />}
                label={privateMode ? "Modo privado activo" : "Modo privado"}
                variant="ghost"
                size="md"
                onClick={onTogglePrivate}
                active={privateMode}
                className="shrink-0"
              />
            )}

            {/* Textarea autogrow */}
            <textarea
              ref={textareaRef}
              value={value}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              rows={1}
              className={cn(
                "flex-1 resize-none bg-transparent text-white placeholder:text-white/40",
                "text-[15px] leading-6 px-2 py-2",
                "outline-none border-0",
                "min-h-[40px] max-h-[160px]",
              )}
              style={{ fieldSizing: "content" } as React.CSSProperties}
            />

            {/* Right actions */}
            <AnimatePresence mode="wait" initial={false}>
              {loading ? (
                <motion.div
                  key="stop"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.15 }}
                  className="shrink-0"
                >
                  <IconButton
                    icon={<Square className="size-3.5 fill-current" />}
                    label="Detener generación"
                    variant="primary"
                    size="md"
                    onClick={onStop}
                  />
                </motion.div>
              ) : hasText ? (
                <motion.div
                  key="send"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.15 }}
                  className="shrink-0"
                >
                  <IconButton
                    icon={<ArrowUp className="size-[18px]" strokeWidth={2.5} />}
                    label="Enviar"
                    variant="primary"
                    size="md"
                    onClick={send}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="voice"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.15 }}
                  className="shrink-0"
                >
                  <IconButton
                    icon={<Mic className="size-[18px]" />}
                    label="Hablar a Noa"
                    variant="ghost"
                    size="md"
                    onClick={onVoiceTap}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    );
  },
);
ChatInput.displayName = "ChatInput";
