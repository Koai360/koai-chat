import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Send,
  Mic,
  Camera,
  Paperclip,
  Palette,
  X,
  ChevronDown,
  Square,
  Loader2,
  Check,
} from "lucide-react";

interface Props {
  onSend: (text: string, imageBase64?: string, imageMode?: boolean, imageEngine?: string) => void;
  onTranscribe: (blob: Blob) => Promise<string>;
  disabled?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  agent?: "kira" | "kronos";
}

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

const ENGINE_OPTIONS = [
  { value: "gemini", label: "Rápida", icon: "zap", desc: "Gemini · gratis" },
  { value: "flux", label: "Profesional", icon: "sparkles", desc: "Flux 2 · premium" },
  { value: "studioflux", label: "Studio", icon: "clapperboard", desc: "Flux Dev · enhanced" },
  { value: "studioflux-raw", label: "Studio RAW", icon: "unlock", desc: "Sin filtro" },
] as const;

export function ChatInput({ onSend, onTranscribe, disabled, placeholder = "Escribe un mensaje...", autoFocus, agent }: Props) {
  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plusOpen, setPlusOpen] = useState(false);
  const [imageMode, setImageMode] = useState(false);
  const [imageEngine, setImageEngine] = useState("gemini");
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const handleResize = () => {
      const keyboardH = window.innerHeight - vv.height - vv.offsetTop;
      document.documentElement.style.setProperty("--keyboard-height", `${Math.max(0, keyboardH)}px`);
    };
    vv.addEventListener("resize", handleResize);
    return () => vv.removeEventListener("resize", handleResize);
  }, []);

  const handleFocus = useCallback(() => {
    setTimeout(() => editorRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 300);
  }, []);

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
    if (file.size > MAX_IMAGE_SIZE) { setError("Imagen muy grande (máx 5MB)"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setImagePreview(dataUrl);
      setImageBase64(dataUrl.split(",")[1]);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const clearImage = () => { setImagePreview(null); setImageBase64(null); };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const toggleRecording = async () => {
    if (recording) { mediaRecorderRef.current?.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 44100 },
      });
      let mimeType = "";
      for (const candidate of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/aac", "audio/ogg;codecs=opus"]) {
        try { if (MediaRecorder.isTypeSupported(candidate)) { mimeType = candidate; break; } } catch {}
      }
      const recorderOptions: MediaRecorderOptions = {};
      if (mimeType) recorderOptions.mimeType = mimeType;
      const recorder = new MediaRecorder(stream, recorderOptions);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        setRecordingTime(0);
        if (chunksRef.current.length === 0) { setError("No se grabó audio"); return; }
        const actualMime = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: actualMime });
        if (blob.size < 100) { setError("Audio muy corto"); return; }
        setTranscribing(true);
        try {
          const transcribed = await onTranscribe(blob);
          if (transcribed) {
            const newText = text ? text + " " + transcribed : transcribed;
            setEditorContent(newText);
            editorRef.current?.focus();
          } else { setError("No se detectó texto"); }
        } catch (err) { setError(err instanceof Error ? err.message : "Error al transcribir"); }
        finally { setTranscribing(false); }
      };
      recorder.onerror = () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        setRecordingTime(0);
        setError("Error al grabar");
      };
      setTimeout(() => { if (recorder.state === "recording") recorder.stop(); }, 60000);
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime((p) => p + 1), 1000);
      if (navigator.vibrate) navigator.vibrate(15);
    } catch { setError("No se pudo acceder al micrófono"); }
  };

  const hasContent = text.trim().length > 0 || !!imageBase64;
  const isDisabled = disabled || transcribing;
  const accentColor = agent === "kronos" ? "kronos" : "kira";

  return (
    <div className="safe-bottom max-w-[48rem] mx-auto w-full px-2 pb-1.5 pt-1">
      {/* Error toast */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="mx-1 mb-1 px-3 py-1.5 bg-destructive/10 border border-destructive/20 rounded-xl text-xs text-destructive text-center"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image preview */}
      {imagePreview && (
        <div className="px-2 pt-2 pb-1">
          <div className="relative inline-block">
            <img src={imagePreview} alt="Preview" className="h-20 w-auto rounded-xl object-cover border border-border-subtle" />
            <button
              onClick={clearImage}
              className="absolute -top-2 -right-2 w-5 h-5 bg-bg-elevated text-text rounded-full flex items-center justify-center border border-border-subtle active:scale-90"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      {/* Recording indicator */}
      <AnimatePresence>
        {recording && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 px-3 py-2"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-destructive animate-pulse" />
            <span className="text-xs font-medium text-destructive">Grabando {formatTime(recordingTime)}</span>
            <div className="flex-1" />
            <Button variant="destructive" size="sm" className="h-6 text-[10px]" onClick={toggleRecording}>
              Detener
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image mode bar */}
      <AnimatePresence>
        {imageMode && !recording && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 px-3 py-2"
          >
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-kira/15 text-kira">
              <Palette className="h-3 w-3" />
              Crear imagen
              <button onClick={() => setImageMode(false)} className="ml-0.5 hover:text-white">
                <X className="h-3 w-3" />
              </button>
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1 px-2">
                  {ENGINE_OPTIONS.find((e) => e.value === imageEngine)?.label}
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                {ENGINE_OPTIONS.map((opt) => (
                  <DropdownMenuItem
                    key={opt.value}
                    onClick={() => setImageEngine(opt.value)}
                    className="flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-medium">{opt.label}</div>
                      <div className="text-[10px] text-text-muted">{opt.desc}</div>
                    </div>
                    {imageEngine === opt.value && <Check className="h-3.5 w-3.5 text-kira" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
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
              className={`shrink-0 w-[38px] h-[44px] flex items-center justify-center active:scale-90 disabled:opacity-40 transition-all duration-200 ${
                plusOpen ? "text-kira rotate-45" : "text-text-muted"
              }`}
            >
              <Plus className="h-5 w-5" />
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" align="start" className="w-52 p-1">
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
              <div className="w-8 h-8 rounded-full bg-kira/10 flex items-center justify-center">
                <Palette className="h-4 w-4 text-kira" />
              </div>
              <div className="text-left">
                <div className="font-medium text-xs">Crear imagen</div>
                <div className="text-[10px] text-text-muted">Gemini, Flux 2 o Studio</div>
              </div>
            </button>
          </PopoverContent>
        </Popover>

        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />

        {/* Input pill */}
        <div className="flex-1 flex items-end bg-bg-surface rounded-[22px] min-h-[44px] border border-border-subtle overflow-hidden">
          <div
            ref={editorRef}
            contentEditable={!isDisabled}
            role="textbox"
            data-placeholder={transcribing ? "Transcribiendo..." : imageMode ? "Describe la imagen..." : placeholder}
            onInput={syncEditorToState}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onPaste={handlePaste}
            className="flex-1 py-[11px] pl-4 text-[16px] leading-[22px] max-h-[120px] overflow-y-auto text-text"
          />
          {/* Camera button */}
          <button
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file"; input.accept = "image/*"; input.capture = "environment";
              input.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (!file) return;
                if (file.size > MAX_IMAGE_SIZE) { setError("Imagen muy grande (máx 5MB)"); return; }
                const reader = new FileReader();
                reader.onload = () => {
                  const dataUrl = reader.result as string;
                  setImagePreview(dataUrl);
                  setImageBase64(dataUrl.split(",")[1]);
                };
                reader.readAsDataURL(file);
              };
              input.click();
            }}
            disabled={isDisabled}
            className="shrink-0 w-10 h-[44px] flex items-center justify-center text-text-muted active:scale-90 disabled:opacity-40"
          >
            <Camera className="h-5 w-5" />
          </button>
        </div>

        {/* Send or Mic button */}
        {hasContent ? (
          <motion.button
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            onClick={handleSubmit}
            disabled={isDisabled}
            className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center active:scale-90 disabled:opacity-50 transition-all mb-0.5 bg-gradient-to-br ${
              accentColor === "kronos"
                ? "from-kronos to-kronos/80"
                : "from-kira to-kira/80"
            } text-bg shadow-lg`}
          >
            <Send className="h-4 w-4" />
          </motion.button>
        ) : (
          <button
            onClick={toggleRecording}
            disabled={isDisabled}
            className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90 mb-0.5 ${
              recording
                ? "bg-destructive text-white animate-pulse"
                : transcribing
                  ? "bg-bg-surface text-text-muted"
                  : `bg-gradient-to-br ${accentColor === "kronos" ? "from-kronos to-kronos/80" : "from-kira to-kira/80"} text-bg shadow-lg`
            } disabled:opacity-50`}
          >
            {transcribing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : recording ? (
              <Square className="h-3.5 w-3.5 fill-current" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
