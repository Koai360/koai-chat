import { useState, useRef, useEffect, useCallback } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  ArrowUp,
  Mic,
  Camera,
  Paperclip,
  Palette,
  X,
  Loader2,
} from "lucide-react";
import { EngineSelector, type EngineValue } from "./EngineSelector";
import { VoiceRecorderOverlay } from "./VoiceRecorderOverlay";
import { useVoiceStream } from "@/hooks/useVoiceStream";

interface Props {
  onSend: (text: string, imageBase64?: string, imageMode?: boolean, imageEngine?: string) => void;
  onTranscribe: (blob: Blob) => Promise<string>;
  disabled?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  agent?: "kira" | "kronos";
}

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_BASE64_SIZE = 2 * 1024 * 1024; // 2MB max base64 para enviar al backend

function compressImage(dataUrl: string, maxBytes: number): Promise<{ base64: string; preview: string }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let { width, height } = img;
      // Escalar si es muy grande
      const maxDim = 1536;
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);

      // Intentar JPEG con calidad decreciente hasta que quepa
      let quality = 0.85;
      let result = canvas.toDataURL("image/jpeg", quality);
      while (result.length * 0.75 > maxBytes && quality > 0.3) {
        quality -= 0.1;
        result = canvas.toDataURL("image/jpeg", quality);
      }
      const b64 = result.split(",")[1];
      resolve({ base64: b64, preview: result });
    };
    img.onerror = () => {
      // Fallback: devolver original
      const b64 = dataUrl.split(",")[1];
      resolve({ base64: b64, preview: dataUrl });
    };
    img.src = dataUrl;
  });
}

// ENGINE_OPTIONS y tipos viven en EngineSelector.tsx (single source of truth)
// Backend dispatch correspondiente: /opt/koai-api/koai/tools/image_gen_tools.py:generate_image()

export function ChatInput({ onSend, onTranscribe: _onTranscribe, disabled, placeholder = "Pregunta algo a Kira...", autoFocus, agent = "kira" }: Props) {
  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [plusOpen, setPlusOpen] = useState(false);
  const [imageMode, setImageMode] = useState(false);
  const [imageEngine, setImageEngine] = useState("gemini");
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textRef = useRef(text);
  textRef.current = text;

  // Voice streaming con Deepgram nova-3 — reemplaza la grabación batch anterior
  const voice = useVoiceStream({
    onFinal: (transcribed) => {
      // Concatena al texto actual (permite múltiples grabaciones)
      const currentText = textRef.current;
      const newText = currentText ? currentText + " " + transcribed : transcribed;
      setEditorContent(newText);
      editorRef.current?.focus();
    },
    onError: (msg) => {
      setError(msg);
    },
    lang: "es",
  });
  const recording = voice.state === "recording";
  const transcribing = voice.state === "transcribing";

  // ChatInput ahora vive in-flow — no necesita tracking de altura

  const syncEditorToState = useCallback(() => {
    if (editorRef.current) setText(editorRef.current.innerText || "");
  }, []);

  const setEditorContent = useCallback((value: string) => {
    if (editorRef.current) {
      editorRef.current.innerText = value;
      setText(value);
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(editorRef.current);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, []);

  useEffect(() => {
    if (autoFocus && editorRef.current) setTimeout(() => editorRef.current?.focus(), 100);
  }, [autoFocus]);

  /**
   * Keyboard detection via focus events.
   *
   * ChatInput vive in-flow dentro del flex column del AppShell. Cuando el
   * teclado virtual abre, iOS/Android shrinken el layout viewport y el
   * contenido se reacomoda naturalmente (el input queda pegado al borde
   * superior del teclado sin cálculos).
   *
   * Este effect solo setea data-keyboard="open" en <html> cuando cualquier
   * text input tiene foco, para que el MobileTabBar colapse y libere
   * espacio vertical al ChatInput.
   */
  useEffect(() => {
    const isTextInput = (el: EventTarget | null): boolean => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      if (tag === "TEXTAREA") return true;
      if (tag === "INPUT") {
        const type = (el as HTMLInputElement).type;
        return !["button", "submit", "reset", "checkbox", "radio", "file", "hidden", "image", "color", "range"].includes(type);
      }
      if (el.isContentEditable) return true;
      return false;
    };

    const onFocusIn = (e: FocusEvent) => {
      if (isTextInput(e.target)) {
        document.documentElement.dataset.keyboard = "open";
      }
    };
    const onFocusOut = (e: FocusEvent) => {
      if (isTextInput(e.target)) {
        // Delay para permitir focus-to-focus transitions sin parpadeo
        setTimeout(() => {
          const active = document.activeElement;
          if (!isTextInput(active)) {
            delete document.documentElement.dataset.keyboard;
          }
        }, 50);
      }
    };

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);

    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      delete document.documentElement.dataset.keyboard;
    };
  }, []);

  // Focus handler — no-op.
  const handleFocus = useCallback(() => {}, []);

  useEffect(() => {
    if (error) {
      const t = setTimeout(() => setError(null), 3000);
      return () => clearTimeout(t);
    }
  }, [error]);

  const handleSubmit = () => {
    if ((!text.trim() && !imageBase64) || disabled) return;
    if (navigator.vibrate) navigator.vibrate(10);
    onSend(text, imageBase64 || undefined, imageMode || undefined, imageMode ? imageEngine : undefined);
    setText("");
    if (editorRef.current) editorRef.current.innerText = "";
    setImagePreview(null);
    setImageBase64(null);
    if (imageMode) setImageMode(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const plainText = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, plainText);
    syncEditorToState();
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_IMAGE_SIZE) { setError("Imagen muy grande (max 5MB)"); return; }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const raw64 = dataUrl.split(",")[1];
      if (!raw64 || raw64.length < 100) { setError("Imagen corrupta, intenta otra"); return; }
      // Comprimir si excede 2MB
      if (raw64.length > MAX_BASE64_SIZE) {
        const { base64, preview } = await compressImage(dataUrl, MAX_BASE64_SIZE);
        setImagePreview(preview);
        setImageBase64(base64);
      } else {
        setImagePreview(dataUrl);
        setImageBase64(raw64);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const clearImage = () => { setImagePreview(null); setImageBase64(null); };

  const toggleRecording = () => {
    if (recording) {
      voice.stop();
    } else {
      voice.start();
    }
  };

  const hasContent = text.trim().length > 0 || !!imageBase64;
  const isDisabled = disabled || transcribing;

  return (
    <div className="shrink-0 bg-bg px-4 pt-2 pb-1 md:pb-2 relative">
      <div className="max-w-[48rem] mx-auto w-full">
      {/* Error toast */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="mx-1 mb-1 px-3 py-1.5 bg-danger-soft border border-danger/20 rounded-xl text-xs text-danger text-center"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image preview */}
      {imagePreview && (
        <div className="px-2 pt-2 pb-1">
          <div className="relative inline-block">
            <img src={imagePreview} alt="Preview" className="h-20 w-auto rounded-xl object-cover border border-border" />
            <button
              onClick={clearImage}
              className="absolute -top-2 -right-2 w-5 h-5 bg-bg-elevated text-text rounded-full flex items-center justify-center border border-border active:scale-90"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      {/* Recording indicator */}
      {/* Voice recorder overlay — waveform + partial text + cancel/send */}
      <VoiceRecorderOverlay
        isVisible={recording}
        elapsedSec={voice.elapsedSec}
        partialText={voice.partialText}
        getAmplitude={voice.getAmplitude}
        onCancel={voice.cancel}
        onStop={voice.stop}
      />

      {/* Image mode panel — header chip + EngineSelector visual */}
      <AnimatePresence>
        {imageMode && !recording && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="px-3 py-2 space-y-2 overflow-hidden"
          >
            {/* Header chip — close button */}
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-text-muted">
                <Palette className="h-3 w-3" />
                Crear imagen
              </span>
              <button
                onClick={() => setImageMode(false)}
                aria-label="Cerrar modo imagen"
                className="text-text-subtle hover:text-text transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Visual engine selector */}
            <EngineSelector
              value={imageEngine as EngineValue}
              onChange={(v) => setImageEngine(v)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input row */}
      <div className="flex items-end gap-1.5">
        {/* Plus menu */}
        <Popover open={plusOpen} onOpenChange={setPlusOpen}>
          <PopoverTrigger asChild>
            <button
              disabled={isDisabled}
              aria-label="Adjuntar archivo"
              className={`shrink-0 w-[38px] h-[44px] flex items-center justify-center active:scale-90 disabled:opacity-40 transition-all duration-200 ${
                plusOpen ? "text-text rotate-45" : "text-text-muted"
              }`}
            >
              <Plus className="h-5 w-5" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="top"
            align="start"
            className="w-52 p-1 bg-bg-elevated border-border shadow-2xl"
            style={{ backgroundColor: "#1a1a1e" }}
          >
            <button
              onClick={() => { fileInputRef.current?.click(); setPlusOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-text hover:bg-bg-surface transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-bg-surface flex items-center justify-center">
                <Paperclip className="h-4 w-4 text-text-muted" />
              </div>
              <div className="text-left">
                <div className="font-medium text-xs">Fotos y archivos</div>
                <div className="text-[10px] text-text-muted">Adjuntar imagen</div>
              </div>
            </button>
            <button
              onClick={() => { setImageMode(true); setPlusOpen(false); editorRef.current?.focus(); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-text hover:bg-bg-surface transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-bg-surface flex items-center justify-center">
                <Palette className="h-4 w-4 text-text-muted" />
              </div>
              <div className="text-left">
                <div className="font-medium text-xs">Crear imagen</div>
                <div className="text-[10px] text-text-muted">5 motores: Gemini, Z-Image, Flux.2 Pro y más</div>
              </div>
            </button>
          </PopoverContent>
        </Popover>

        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />

        {/* Input pill */}
        <div
          className="flex-1 flex items-end min-h-[44px] overflow-hidden liquid-glass-strong transition-all duration-300 rounded-lg"
        >
          <div
            ref={editorRef}
            contentEditable={!isDisabled}
            role="textbox"
            aria-label="Escribe tu mensaje"
            data-placeholder={transcribing ? "Transcribiendo..." : imageMode ? "Describe la imagen..." : placeholder}
            onInput={syncEditorToState}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onPaste={handlePaste}
            // NOTA: la barra ^/v/✓ de iOS (Form Assistant / accessory view)
            // NO se puede ocultar desde una PWA web — es parte nativa del
            // teclado iOS y aparece para cualquier input/contenteditable.
            // Solo Apple la puede desactivar. Los attrs de abajo desactivan
            // autocorrect/suggestions/spellcheck pero NO la barra en sí.
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="sentences"
            // @ts-expect-error — atributo no estándar React pero soportado por iOS
            autoComplete="off"
            inputMode="text"
            enterKeyHint="send"
            className="flex-1 py-[11px] pl-4 text-[16px] leading-[22px] max-h-[120px] overflow-y-auto text-text"
          />
          {/* Camera button */}
          <button
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file"; input.accept = "image/*"; input.capture = "environment";
              input.onchange = (ev) => {
                const file = (ev.target as HTMLInputElement).files?.[0];
                if (!file) return;
                if (file.size > MAX_IMAGE_SIZE) { setError("Imagen muy grande (max 5MB)"); return; }
                const reader = new FileReader();
                reader.onload = async () => {
                  const dataUrl = reader.result as string;
                  const raw64 = dataUrl.split(",")[1];
                  if (!raw64 || raw64.length < 100) { setError("Imagen corrupta, intenta otra"); return; }
                  if (raw64.length > MAX_BASE64_SIZE) {
                    const { base64, preview } = await compressImage(dataUrl, MAX_BASE64_SIZE);
                    setImagePreview(preview);
                    setImageBase64(base64);
                  } else {
                    setImagePreview(dataUrl);
                    setImageBase64(raw64);
                  }
                };
                reader.readAsDataURL(file);
              };
              input.click();
            }}
            disabled={isDisabled}
            aria-label="Tomar foto"
            className="shrink-0 w-10 h-[44px] flex items-center justify-center text-text-muted active:scale-90 disabled:opacity-40"
          >
            <Camera className="h-5 w-5" />
          </button>
        </div>

        {/* Mic button — abre el overlay de grabación. Mientras grabas o
            transcribes, el botón del input se oculta y el overlay maneja
            los controles stop/cancel. */}
        {!hasContent && !recording && (
          <button
            onClick={toggleRecording}
            disabled={isDisabled}
            aria-label="Entrada de voz"
            className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90 mb-0.5 disabled:opacity-50 text-text-muted hover:text-text"
          >
            {transcribing ? (
              <Loader2 className="h-4 w-4 animate-spin text-text-muted" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </button>
        )}

        {/* Send button */}
        {hasContent && (
          <motion.button
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            onClick={handleSubmit}
            disabled={isDisabled}
            aria-label="Enviar mensaje"
            className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center active:scale-90 disabled:opacity-50 transition-all mb-1"
            style={{
              backgroundColor: agent === "kronos" ? "#00E5FF" : "#D4E94B",
              color: "#0a0a0c",
              boxShadow: `0 0 12px 2px ${agent === "kronos" ? "rgba(0,229,255,0.3)" : "rgba(197,227,74,0.3)"}`,
            }}
          >
            <ArrowUp className="h-4 w-4" />
          </motion.button>
        )}
      </div>

      {/* Disclaimer — hidden on mobile to save space */}
      <p className="hidden md:block text-[11px] text-text-muted text-center mt-2">
        Kira puede cometer errores. Verifica la información importante.
      </p>
      </div>
    </div>
  );
}
