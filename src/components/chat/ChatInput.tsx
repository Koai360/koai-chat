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
  Square,
} from "lucide-react";
import { EngineSelector, type EngineValue } from "./EngineSelector";
import { SlashCommandMenu, COMMANDS, type SlashCommand } from "./SlashCommandMenu";
import { VoiceRecorderOverlay } from "./VoiceRecorderOverlay";
import { useVoiceStream } from "@/hooks/useVoiceStream";

interface Props {
  onSend: (text: string, imageBase64?: string, imageMode?: boolean, imageEngine?: string, editMode?: boolean, imageUrl?: string) => void;
  /** Detener generación activa (cancela stream) */
  onStop?: () => void;
  /** Estado de loading — cuando true el botón send se convierte en stop */
  loading?: boolean;
  onTranscribe: (blob: Blob) => Promise<string>;
  disabled?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  agent?: "noa" | "kronos";
  /** URL de imagen existente en R2 para edit iterativo (click "Editar" en chat/galería) */
  editSourceUrl?: string | null;
  /** Callback para limpiar la URL cuando el usuario cancela el edit */
  onClearEditSource?: () => void;
  /** Última imagen generada — para botón "Editar esta" rápido */
  lastGeneratedImage?: { url: string; messageId?: string } | null;
  /** ADK memory usage ratio (0.0-1.0) — indicador visual de contexto */
  memoryUsage?: number;
}

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_BASE64_SIZE = 2 * 1024 * 1024; // 2MB max base64 para enviar al backend

function haptic(ms = 8) {
  if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(ms);
}

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

export function ChatInput({ onSend, onStop, loading, onTranscribe: _onTranscribe, disabled, placeholder = "Pregunta algo a Noa...", autoFocus, agent = "noa", editSourceUrl, onClearEditSource, lastGeneratedImage, memoryUsage: _memoryUsage = 0 }: Props) {
  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMeta, setImageMeta] = useState<{ size: number; width?: number; height?: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [plusOpen, setPlusOpen] = useState(false);
  const [imageMode, setImageMode] = useState(false);
  const [imageEngine, setImageEngine] = useState("gemini");
  // editMode: cuando hay imagen adjunta, permite elegir si la imagen se USA como
  // referencia (default, pasa al LLM) o si se EDITA con edit_image_smart (Kontext).
  const [editMode, setEditMode] = useState(false);
  const [showSlash, setShowSlash] = useState(false);
  const [slashIndex, setSlashIndex] = useState(0);

  const editorRef = useRef<HTMLTextAreaElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<{ base64: string; name: string; type: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textRef = useRef(text);
  textRef.current = text;

  // Auto-activar editMode cuando viene una URL externa (click "Editar" en chat/galería)
  useEffect(() => {
    if (editSourceUrl) {
      setEditMode(true);
      setImagePreview(editSourceUrl);
      editorRef.current?.focus();
    }
  }, [editSourceUrl]);

  // Escuchar trigger-animate: envía automáticamente un mensaje pidiendo animación
  useEffect(() => {
    const handler = (e: Event) => {
      const url = (e as CustomEvent<{ url: string }>).detail?.url;
      if (url) {
        onSend(`Anima esta imagen con movimiento suave y natural`, undefined, undefined, undefined, true, url);
      }
    };
    window.addEventListener("trigger-animate", handler);
    return () => window.removeEventListener("trigger-animate", handler);
  }, [onSend]);

  // Escuchar eventos de prefill disparados desde EmptyState quick actions.
  // Permite que los shortcuts prellenen el input sin enviar automáticamente.
  useEffect(() => {
    const handlePrefill = (e: Event) => {
      const detail = (e as CustomEvent<{
        text?: string;
        imageMode?: boolean;
        imageEngine?: string;
      }>).detail;
      if (!detail) return;
      if (detail.text !== undefined) setText(detail.text);
      if (detail.imageMode) {
        setImageMode(true);
        if (detail.imageEngine) setImageEngine(detail.imageEngine);
      }
      // Focus + select para que el user pueda editar rápido
      setTimeout(() => {
        editorRef.current?.focus();
        editorRef.current?.select();
      }, 50);
    };
    const handleFocus = () => {
      setTimeout(() => editorRef.current?.focus(), 50);
    };
    window.addEventListener("chat-prefill", handlePrefill);
    window.addEventListener("chat-focus", handleFocus);
    return () => {
      window.removeEventListener("chat-prefill", handlePrefill);
      window.removeEventListener("chat-focus", handleFocus);
    };
  }, []);

  // Auto-grow textarea hasta max-h (120px). Llamar después de cambios de `text`.
  const autoGrow = () => {
    const el = editorRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  // Ajustar altura cuando cambia text programáticamente (voice, clear, etc.)
  useEffect(() => {
    autoGrow();
  }, [text]);

  // Voice streaming con Deepgram nova-3 — reemplaza la grabación batch anterior
  const voice = useVoiceStream({
    onFinal: (transcribed) => {
      // Concatena al texto actual (permite múltiples grabaciones).
      // Usa textRef para evitar stale closure en callbacks del WS.
      const currentText = textRef.current;
      const newText = currentText ? currentText + " " + transcribed : transcribed;
      setText(newText);
      setTimeout(() => editorRef.current?.focus(), 0);
    },
    onError: (msg) => {
      setError(msg);
    },
    lang: "es",
  });
  const recording = voice.state === "recording";
  const transcribing = voice.state === "transcribing";

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
      // 5s en vez de 3s — errores de upload requieren tiempo para leer y reaccionar.
      const t = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(t);
    }
  }, [error]);

  const handleSubmit = () => {
    // Validación: si editMode + editSourceUrl, solo necesitamos texto
    // Si editMode + upload manual, necesitamos base64 y texto
    // Si modo normal, necesitamos texto O base64
    const hasUrl = !!editSourceUrl;
    const hasImage = !!imageBase64 || hasUrl;
    if ((!text.trim() && !hasImage) || disabled) return;
    if (editMode && !text.trim()) return;  // edit siempre requiere instrucción
    if (editMode && !hasImage) return;
    haptic(10);
    onSend(
      text,
      imageBase64 || undefined,
      imageMode || undefined,
      imageMode ? imageEngine : undefined,
      editMode || undefined,
      editSourceUrl || undefined,
    );
    setText("");
    setImagePreview(null);
    setImageBase64(null);
    if (imageMode) setImageMode(false);
    if (editMode) setEditMode(false);
    if (editSourceUrl && onClearEditSource) onClearEditSource();
  };

  const handleSlashSelect = useCallback((cmd: SlashCommand) => {
    setShowSlash(false);
    setSlashIndex(0);
    if (cmd.action === "mode" && cmd.payload === "image") {
      setText("");
      setImageMode(true);
    } else if (cmd.action === "prefill") {
      setText(cmd.payload);
      requestAnimationFrame(() => editorRef.current?.focus());
    } else if (cmd.action === "navigate") {
      setText("");
      window.location.hash = cmd.payload;
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSlash) {
      const filtered = COMMANDS.filter((c) =>
        c.command.startsWith(text.toLowerCase()) || c.label.toLowerCase().includes(text.slice(1).toLowerCase())
      );
      if (e.key === "ArrowDown") { e.preventDefault(); setSlashIndex((i) => Math.min(i + 1, filtered.length - 1)); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setSlashIndex((i) => Math.max(i - 1, 0)); return; }
      if (e.key === "Enter") { e.preventDefault(); if (filtered[slashIndex]) handleSlashSelect(filtered[slashIndex]); return; }
      if (e.key === "Escape") { setShowSlash(false); return; }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const readImageDimensions = (dataUrl: string): Promise<{ width: number; height: number }> =>
    new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve({ width: 0, height: 0 });
      img.src = dataUrl;
    });

  const processImageFile = async (file: File) => {
    if (file.size > MAX_IMAGE_SIZE) { setError("Imagen muy grande (max 5MB)"); return; }
    const originalSize = file.size;
    const dataUrl: string = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
    const raw64 = dataUrl.split(",")[1];
    if (!raw64 || raw64.length < 100) { setError("Imagen corrupta, intenta otra"); return; }
    if (raw64.length > MAX_BASE64_SIZE) {
      const { base64, preview } = await compressImage(dataUrl, MAX_BASE64_SIZE);
      setImagePreview(preview);
      setImageBase64(base64);
      const dims = await readImageDimensions(preview);
      setImageMeta({ size: Math.round(base64.length * 0.75), width: dims.width, height: dims.height });
    } else {
      setImagePreview(dataUrl);
      setImageBase64(raw64);
      const dims = await readImageDimensions(dataUrl);
      setImageMeta({ size: originalSize, width: dims.width, height: dims.height });
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void processImageFile(file);
    e.target.value = "";
  };

  const openCamera = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.capture = "environment";
    input.onchange = (ev) => {
      const file = (ev.target as HTMLInputElement).files?.[0];
      if (file) void processImageFile(file);
    };
    input.click();
  };

  const clearImage = () => {
    setImagePreview(null);
    setImageBase64(null);
    setImageMeta(null);
    setEditMode(false);
    if (editSourceUrl && onClearEditSource) onClearEditSource();
  };

  const handleDocSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setError("Archivo muy grande (max 10MB)"); return; }

    // Para archivos de texto/CSV: leer como texto y pegar en el input
    if (file.type === "text/plain" || file.type === "text/csv" || file.name.endsWith(".txt") || file.name.endsWith(".csv")) {
      const reader = new FileReader();
      reader.onload = () => {
        const content = (reader.result as string).slice(0, 50000);
        setPendingFile({ base64: "", name: file.name, type: file.type });
        setText((prev) => `${prev}\n\n[Archivo: ${file.name}]\n${content}`.trim());
      };
      reader.readAsText(file);
    } else {
      // Para PDFs y otros: leer como base64 para enviar al backend
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const b64 = dataUrl.split(",")[1];
        setPendingFile({ base64: b64, name: file.name, type: file.type });
      };
      reader.readAsDataURL(file);
    }
    e.target.value = "";
  };

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
      <div className="max-w-[48rem] mx-auto w-full relative">
      {/* Slash command menu */}
      <AnimatePresence>
        {showSlash && (
          <SlashCommandMenu
            filter={text}
            onSelect={handleSlashSelect}
            selectedIndex={slashIndex}
          />
        )}
      </AnimatePresence>
      {/* Error toast — dismiss manual con X, 5s fallback */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="mx-1 mb-1 px-3 py-1.5 bg-danger-soft border border-danger/20 rounded-xl text-xs text-danger flex items-center justify-center gap-2"
          >
            <span className="flex-1 text-center">{error}</span>
            <button
              onClick={() => setError(null)}
              aria-label="Cerrar aviso"
              className="shrink-0 text-danger/70 hover:text-danger transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pending file chip */}
      {pendingFile && (
        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mx-1 mb-1.5">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-bg-surface border border-noa/20">
            <Paperclip className="size-3.5 text-noa" />
            <span className="text-[11px] text-text truncate max-w-[200px]">{pendingFile.name}</span>
            <button onClick={() => setPendingFile(null)} className="text-text-muted hover:text-text">
              <X className="size-3" />
            </button>
          </div>
        </motion.div>
      )}

      {/* Quick edit last generated image — chip above input */}
      {lastGeneratedImage && !imagePreview && !editSourceUrl && !editMode && !loading && (
        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mx-1 mb-1.5">
          <button
            onClick={() => {
              haptic(8);
              // Inyectar la URL como editSourceUrl via el mismo mecanismo que usa la galería
              // onClearEditSource resetea el anterior, luego seteamos el nuevo
              if (onClearEditSource) onClearEditSource();
              // Pequeño delay para que el clear se procese antes del set
              requestAnimationFrame(() => {
                window.dispatchEvent(new CustomEvent("trigger-edit", { detail: { url: lastGeneratedImage.url } }));
              });
            }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-bg-surface border border-border hover:border-noa/30 transition-all text-left group"
          >
            <img src={lastGeneratedImage.url} alt="" className="w-7 h-7 rounded-md object-cover shrink-0" />
            <span className="text-[11px] text-text-muted group-hover:text-text transition-colors">
              ✎ Editar última imagen
            </span>
          </button>
        </motion.div>
      )}

      {/* Image preview + mode segmented (Generar con referencia | Editar) */}
      {imagePreview && (
        <div className="px-2 pt-2 pb-1 flex items-start gap-3">
          <div className="shrink-0 flex flex-col items-center gap-0.5">
            <div className="relative inline-block">
              <img src={imagePreview} alt="Preview" className="h-20 w-auto rounded-xl object-cover border border-border" />
              <button
                onClick={clearImage}
                className="absolute -top-2 -right-2 w-5 h-5 bg-bg-elevated text-text rounded-full flex items-center justify-center border border-border active:scale-90"
                aria-label="Quitar imagen"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            {imageMeta && (
              <span className="font-mono text-[9px] text-text-subtle tracking-tight whitespace-nowrap">
                {imageMeta.size < 1024
                  ? `${imageMeta.size}B`
                  : imageMeta.size < 1048576
                    ? `${Math.round(imageMeta.size / 1024)}KB`
                    : `${(imageMeta.size / 1048576).toFixed(1)}MB`}
                {imageMeta.width && imageMeta.height ? ` · ${imageMeta.width}×${imageMeta.height}` : ""}
              </span>
            )}
          </div>
          {/* Segmented: Generar con referencia / Editar esta imagen */}
          <div className="flex-1 min-w-0 flex flex-col gap-1.5">
            <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-text-subtle px-0.5">
              Qué hacer con la imagen
            </span>
            <div role="radiogroup" aria-label="Modo de imagen" className="grid grid-cols-2 gap-1">
              <button
                role="radio"
                aria-checked={!editMode}
                onClick={() => { haptic(6); setEditMode(false); }}
                className={`
                  text-[11px] font-medium py-2 px-2 rounded-lg border transition-all duration-200
                  ${!editMode
                    ? "bg-white/10 border-white/30 text-text"
                    : "bg-transparent border-white/10 text-text-subtle hover:bg-white/5"}
                `}
              >
                Usar como referencia
              </button>
              <button
                role="radio"
                aria-checked={editMode}
                onClick={() => { haptic(6); setEditMode(true); }}
                className={`
                  text-[11px] font-medium py-2 px-2 rounded-lg border transition-all duration-200
                  ${editMode
                    ? "bg-[rgba(123,45,142,0.12)] border-[rgba(123,45,142,0.55)] text-[#E5A3F0]"
                    : "bg-transparent border-white/10 text-text-subtle hover:bg-white/5"}
                `}
              >
                Editar esta imagen
              </button>
            </div>
            {editMode && (
              <span className="font-mono text-[9.5px] text-text-subtle px-0.5 leading-snug">
                Kontext Pro · cambio de ropa, fondos, look — preserva el resto
              </span>
            )}
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

      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
      <input ref={docInputRef} type="file" accept=".pdf,.csv,.txt,.doc,.docx,.xls,.xlsx" onChange={handleDocSelect} className="hidden" />

      {/* Input — pill único fluido: Plus abs-left, textarea con padding, Mic+Send abs-right.
          Altura mínima 52px (10+40+2). El textarea crece hasta 120px, los botones quedan
          anclados al fondo (bottom-1) para que el multi-line no los desplace. */}
      <div className="relative flex items-end min-h-[52px] liquid-glass-strong transition-all duration-300 rounded-2xl">
        {/* Plus menu — absolute left, dentro del pill */}
        <Popover open={plusOpen} onOpenChange={setPlusOpen}>
          <PopoverTrigger asChild>
            <button
              disabled={isDisabled}
              aria-label="Adjuntar archivo"
              className={`absolute left-1 bottom-1 z-10 w-10 h-10 rounded-full flex items-center justify-center active:scale-90 disabled:opacity-40 transition-all duration-200 ${
                plusOpen ? "text-text rotate-45 bg-bg-surface" : "text-text-muted hover:text-text"
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
                <div className="font-medium text-xs">Adjuntar imagen</div>
                <div className="text-[10px] text-text-muted">JPG, PNG, WebP</div>
              </div>
            </button>
            <button
              onClick={() => { openCamera(); setPlusOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-text hover:bg-bg-surface transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-bg-surface flex items-center justify-center">
                <Camera className="h-4 w-4 text-text-muted" />
              </div>
              <div className="text-left">
                <div className="font-medium text-xs">Tomar foto</div>
                <div className="text-[10px] text-text-muted">Cámara trasera del dispositivo</div>
              </div>
            </button>
            <button
              onClick={() => { docInputRef.current?.click(); setPlusOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-text hover:bg-bg-surface transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-bg-surface flex items-center justify-center">
                <Paperclip className="h-4 w-4 text-noa" />
              </div>
              <div className="text-left">
                <div className="font-medium text-xs">Adjuntar archivo</div>
                <div className="text-[10px] text-text-muted">PDF, CSV, TXT, DOC</div>
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

        <textarea
          ref={editorRef}
          value={text}
          onChange={(e) => {
            const v = e.target.value;
            setText(v);
            // Slash menu: solo mientras escribes el comando.
            // Se cierra al meter un espacio (ya escribiste el comando, ahora args)
            // o cuando pasas de 15 chars (mensaje normal que empieza con "/").
            if (v.startsWith("/") && v.length <= 15 && !v.includes(" ")) {
              setShowSlash(true);
              setSlashIndex(0);
            } else {
              setShowSlash(false);
            }
          }}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          disabled={isDisabled}
          rows={1}
          aria-label="Escribe tu mensaje"
          placeholder={transcribing ? "Transcribiendo..." : editMode ? "Qué cambiar en la imagen..." : imageMode ? "Describe la imagen..." : placeholder}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="sentences"
          autoComplete="off"
          inputMode="text"
          enterKeyHint="send"
          style={{ fontSize: "var(--text-input, 16px)" }}
          className="w-full py-[14px] pl-[52px] pr-[96px] leading-[22px] max-h-[120px] overflow-y-auto text-text bg-transparent border-none outline-none resize-none placeholder:text-text-muted disabled:opacity-60"
        />

        {/* Right action cluster — Mic, Stop, Send. Anclados bottom-right para que
            no se desplacen cuando el textarea crece multi-line. */}
        <div className="absolute right-1 bottom-1 z-10 flex items-center gap-0.5">
          {!recording && !loading && !hasContent && (
            <button
              onClick={toggleRecording}
              disabled={isDisabled}
              aria-label="Entrada de voz"
              className="w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-90 disabled:opacity-50 text-text-muted hover:text-text"
            >
              {transcribing ? (
                <Loader2 className="h-[18px] w-[18px] animate-spin text-text-muted" />
              ) : (
                <Mic className="h-[18px] w-[18px]" />
              )}
            </button>
          )}

          {/* Stop button — visible durante loading (reemplaza send) */}
          {loading && onStop && (
            <motion.button
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              onClick={(e) => {
                e.preventDefault();
                haptic(12);
                onStop();
              }}
              aria-label="Detener generación"
              className="w-10 h-10 rounded-xl flex items-center justify-center active:scale-90 transition-all bg-white text-[#0a0a0c]"
              style={{
                boxShadow: "0 0 12px 2px rgba(255,255,255,0.25)",
              }}
            >
              <Square className="h-3.5 w-3.5 fill-current" />
            </motion.button>
          )}

          {/* Send button — rounded-xl (R12), color por agente, glow */}
          {hasContent && !loading && (
            <motion.button
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              onClick={handleSubmit}
              disabled={isDisabled}
              aria-label="Enviar mensaje"
              className="w-10 h-10 rounded-xl flex items-center justify-center active:scale-90 disabled:opacity-50 transition-all"
              style={{
                backgroundColor: agent === "kronos" ? "#00E5FF" : "#D4E94B",
                color: "#0a0a0c",
                boxShadow: `0 0 12px 2px ${agent === "kronos" ? "rgba(0,229,255,0.3)" : "rgba(197,227,74,0.3)"}`,
              }}
            >
              <ArrowUp className="h-[18px] w-[18px]" />
            </motion.button>
          )}
        </div>
      </div>

      {/* Memory indicator movido al TopBar (chip junto a ThinkingLevel) para
          agrupar "estado del agente" en un solo lugar y mantener el input limpio. */}

      {/* Disclaimer — hidden on mobile to save space */}
      <p className="hidden md:block text-[11px] text-text-muted text-center mt-2">
        Noa puede cometer errores. Verifica la información importante.
      </p>
      </div>
    </div>
  );
}
