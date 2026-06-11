import { forwardRef, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUp, Mic, Plus, Shield, Square, X, FileText, Image as ImageIcon } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { VoiceBar } from "./VoiceBar";
import { cn } from "@/lib/cn";

export interface AttachedFile {
  kind: "image" | "doc";
  name: string;
  size: number;
  mime: string;
  base64: string;
  previewUrl?: string;
}

interface ChatInputProps {
  /** Retornar `false` (o Promise<false>) si el envío NO fue aceptado — el
   *  input restaura el texto/adjuntos para no perder lo tipeado (S158-b). */
  onSend: (text: string, attachments?: AttachedFile[]) => void | boolean | Promise<void | boolean>;
  onStop?: () => void;
  loading?: boolean;
  privateMode?: boolean;
  onTogglePrivate?: () => void;
  placeholder?: string;
  /** Si true, al confirmar el audio se envía directo. Si false, popula el textbox. */
  autoSendVoice?: boolean;
}

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB safety cap
const IMAGE_MIMES = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/heic", "image/heif"];

// S161: en pantallas táctiles Enter NUNCA envía — el teclado iOS con
// autocorrect/dictado dispara Enter fantasma a medio commit y mandaba
// mensajes incompletos pese al guard isComposing (S158-b). En touch el
// envío es SOLO con el botón →; el return hace salto de línea.
const isCoarsePointer =
  typeof window !== "undefined" &&
  window.matchMedia?.("(pointer: coarse)").matches === true;

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
      loading = false,
      privateMode = false,
      onTogglePrivate,
      placeholder = "Pregúntale a Noa",
      autoSendVoice = false,
    },
    ref,
  ) => {
    const [value, setValue] = useState("");
    const [attachments, setAttachments] = useState<AttachedFile[]>([]);
    const [voiceActive, setVoiceActive] = useState(false);
    const internalRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = (ref as React.RefObject<HTMLTextAreaElement>) ?? internalRef;

    const hasContent = value.trim().length > 0 || attachments.length > 0;

    const handleVoiceStart = () => setVoiceActive(true);
    const handleVoiceCancel = () => setVoiceActive(false);
    const handleVoiceTranscript = (text: string) => {
      setVoiceActive(false);
      if (autoSendVoice) {
        // Send directo sin mostrar texto en el input — UX más rápida.
        // Si ya había texto tipeado, se combina (no se descarta).
        const combined = value.trim() ? `${value.trim()} ${text}` : text;
        void onSend(combined, attachments.length > 0 ? attachments : undefined);
        setValue("");
        setAttachments([]);
      } else {
        // Populate el input para que el user edite antes de send
        setValue((prev) => (prev ? `${prev} ${text}` : text));
        // S158-b: en iOS Safari field-sizing no existe → sin adjustHeight el
        // textarea no crece con el dictado y el texto queda oculto
        requestAnimationFrame(() => {
          textareaRef.current?.focus();
          adjustHeight();
        });
      }
    };

    const handleAttachClick = () => {
      fileInputRef.current?.click();
    };

    const handleFilesPicked = async (e: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      e.target.value = ""; // reset input para permitir re-selección del mismo archivo
      if (files.length === 0) return;

      const next: AttachedFile[] = [];
      for (const f of files) {
        if (f.size > MAX_FILE_SIZE) {
          window.alert(`"${f.name}" excede 25 MB y fue ignorado.`);
          continue;
        }
        try {
          const base64 = await readFileAsBase64(f);
          const isImage = IMAGE_MIMES.includes(f.type) || f.type.startsWith("image/");
          const att: AttachedFile = {
            kind: isImage ? "image" : "doc",
            name: f.name,
            size: f.size,
            mime: f.type || "application/octet-stream",
            base64,
          };
          if (isImage) {
            att.previewUrl = `data:${att.mime};base64,${base64}`;
          }
          next.push(att);
        } catch (err) {
          console.warn("[ChatInput] file read failed", err);
        }
      }
      setAttachments((prev) => [...prev, ...next]);
    };

    const removeAttachment = (idx: number) => {
      setAttachments((prev) => prev.filter((_, i) => i !== idx));
    };

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
      // S161: touch = Enter inserta newline, nunca envía (ver isCoarsePointer)
      if (isCoarsePointer) return;
      // S158-b: guard de composición — dictado iOS/autocorrect/IME con marked
      // text activo disparaba send con texto a medio commit (mensajes cortados)
      if (e.nativeEvent.isComposing || e.keyCode === 229) return;
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void send();
      }
    };

    const send = async () => {
      const text = value.trim();
      if ((!text && attachments.length === 0) || loading) return;
      // Limpieza optimista (UX instantánea) + restore si el envío falla —
      // antes un fallo de createConversation perdía el mensaje tipeado (S158-b)
      const prevValue = value;
      const prevAttachments = attachments;
      setValue("");
      setAttachments([]);
      requestAnimationFrame(() => {
        if (textareaRef.current) textareaRef.current.style.height = "auto";
      });
      const ok = await Promise.resolve(
        onSend(text, prevAttachments.length > 0 ? prevAttachments : undefined),
      ).catch(() => false);
      if (ok === false) {
        setValue(prevValue);
        setAttachments(prevAttachments);
        requestAnimationFrame(adjustHeight);
      }
    };

    return (
      // S161: barra más abajo estilo X — pb-0.5 + safe-bottom-tight
      // (mobile: ~22px bajo el pill vs 46px antes; desktop igual que antes)
      <div className="px-3 md:px-6 pb-0.5 md:pb-3 safe-bottom-tight">
        <div className="mx-auto max-w-3xl">
          {/* Hidden file input — multiple, image + doc */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,application/pdf,text/plain,text/csv,.md,.json,.txt,.pdf,.csv"
            onChange={handleFilesPicked}
            className="hidden"
            aria-hidden
          />

          {/* Attachments chips arriba del input — visibles también durante el
              dictado (S161: que se vea que la imagen sigue adjunta) */}
          {attachments.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap mb-2 px-1">
              {attachments.map((att, i) => (
                <AttachmentChip key={`${att.name}-${i}`} att={att} onRemove={() => removeAttachment(i)} />
              ))}
            </div>
          )}

          {/* Voice recording inline reemplaza el pill */}
          <AnimatePresence mode="wait" initial={false}>
            {voiceActive && (
              <VoiceBar
                key="voice-bar"
                onTranscript={handleVoiceTranscript}
                onCancel={handleVoiceCancel}
              />
            )}
          </AnimatePresence>

          {!voiceActive && (
          <div
            className={cn(
              "flex items-end gap-1.5 px-2.5 py-2",
              "bg-[var(--color-bg-input)] border border-[var(--color-border-hi)]",
              "rounded-[26px] transition-all duration-200",
              // S161: magic-border = conic gradient lime/violeta rotando al
              // enfocar (globals.css §motion pack); reemplaza el ring estático
              "magic-border focus-within:border-transparent",
            )}
          >
            {/* Attach + (multiple files) */}
            <IconButton
              icon={<Plus className="size-[20px]" strokeWidth={2.2} />}
              label="Adjuntar archivos"
              variant="ghost"
              size="md"
              onClick={handleAttachClick}
              className="shrink-0"
            />

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
              enterKeyHint={isCoarsePointer ? "enter" : "send"}
              className={cn(
                "flex-1 resize-none bg-transparent text-white",
                "placeholder:text-white/55 placeholder:font-mono placeholder:text-[14px] placeholder:tracking-tight",
                "text-[15px] leading-6 px-2 py-2",
                "outline-none border-none focus:outline-none focus:ring-0",
                "min-h-[40px] max-h-[160px]",
              )}
              style={{ fieldSizing: "content" } as React.CSSProperties}
            />

            {/* Right actions — mic SIEMPRE disponible (S161: antes desaparecía
                con texto/adjuntos y no se podía seguir dictando) */}
            {!loading && (
              <IconButton
                icon={<Mic className="size-[18px]" />}
                label="Hablar a Noa"
                variant="ghost"
                size="md"
                onClick={handleVoiceStart}
                className="shrink-0"
              />
            )}
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
              ) : hasContent ? (
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
                    className="active:scale-90"
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
          )}
        </div>
      </div>
    );
  },
);
ChatInput.displayName = "ChatInput";

// ============================================================================
// Helpers
// ============================================================================

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("FileReader returned non-string"));
        return;
      }
      // result tiene formato "data:<mime>;base64,<b64>" — extraemos solo el b64
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface AttachmentChipProps {
  att: AttachedFile;
  onRemove: () => void;
}

function AttachmentChip({ att, onRemove }: AttachmentChipProps) {
  return (
    <div
      className={cn(
        "group inline-flex items-center gap-2 pl-1.5 pr-2 py-1.5",
        "bg-white/[0.04] border border-white/[0.10] rounded-xl",
        "text-[12px] text-white/85 max-w-[220px]",
      )}
    >
      {att.kind === "image" && att.previewUrl ? (
        <img
          src={att.previewUrl}
          alt=""
          className="size-9 rounded-lg object-cover shrink-0"
        />
      ) : (
        <div className="size-9 rounded-lg bg-white/[0.08] flex items-center justify-center shrink-0">
          {att.kind === "image" ? (
            <ImageIcon className="size-4 text-white/70" />
          ) : (
            <FileText className="size-4 text-white/70" />
          )}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="truncate font-medium text-white/95 text-[12px]">{att.name}</p>
        <p className="mono text-[10px] text-white/45 tracking-tight">{formatSize(att.size)}</p>
      </div>
      <button
        onClick={onRemove}
        // S158-b: hit area extendida a ~36px via pseudo-element (el visual
        // sigue 20px) — antes el target real era 20px, frustrante en touch
        className="relative shrink-0 size-5 rounded-full bg-white/[0.06] hover:bg-white/[0.15] flex items-center justify-center after:absolute after:-inset-2 after:content-['']"
        aria-label="Quitar archivo"
      >
        <X className="size-3 text-white/70" />
      </button>
    </div>
  );
}
