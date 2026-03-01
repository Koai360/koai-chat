import { useState, useRef, useEffect, useCallback } from "react";

interface Props {
  onSend: (text: string, imageBase64?: string) => void;
  onTranscribe: (blob: Blob) => Promise<string>;
  disabled?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  agent?: "kira" | "kronos";
}

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

export function ChatInput({ onSend, onTranscribe, disabled, placeholder = "Escribe un mensaje...", autoFocus, agent = "kira" }: Props) {
  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync text state when editor content changes externally (e.g. after transcription)
  const syncEditorToState = useCallback(() => {
    if (editorRef.current) {
      const content = editorRef.current.innerText || "";
      setText(content);
    }
  }, []);

  // Set editor content programmatically (e.g. after transcription)
  const setEditorContent = useCallback((value: string) => {
    if (editorRef.current) {
      editorRef.current.innerText = value;
      setText(value);
      // Move cursor to end
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(editorRef.current);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, []);

  // Auto-focus when requested
  useEffect(() => {
    if (autoFocus && editorRef.current) {
      setTimeout(() => editorRef.current?.focus(), 100);
    }
  }, [autoFocus]);

  // Detect keyboard open/close via visualViewport
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

  // Scroll input into view when keyboard opens
  const handleFocus = useCallback(() => {
    setTimeout(() => {
      editorRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 300);
  }, []);

  // Clear error after 3s
  useEffect(() => {
    if (error) {
      const t = setTimeout(() => setError(null), 3000);
      return () => clearTimeout(t);
    }
  }, [error]);

  const handleSubmit = () => {
    if ((!text.trim() && !imageBase64) || disabled) return;
    if (navigator.vibrate) navigator.vibrate(10);
    onSend(text, imageBase64 || undefined);
    setText("");
    if (editorRef.current) editorRef.current.innerText = "";
    setImagePreview(null);
    setImageBase64(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = () => {
    syncEditorToState();
  };

  // Prevent pasting rich text — only allow plain text
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const plainText = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, plainText);
    syncEditorToState();
  };

  // --- Image handling ---
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_IMAGE_SIZE) {
      setError("Imagen muy grande (máx 5MB)");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setImagePreview(dataUrl);
      const base64 = dataUrl.split(",")[1];
      setImageBase64(base64);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const clearImage = () => {
    setImagePreview(null);
    setImageBase64(null);
  };

  // --- Audio recording ---
  const startRecordingTimer = () => {
    setRecordingTime(0);
    timerRef.current = setInterval(() => {
      setRecordingTime((prev) => prev + 1);
    }, 1000);
  };

  const stopRecordingTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRecordingTime(0);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const toggleRecording = async () => {
    if (recording) {
      mediaRecorderRef.current?.stop();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      });

      // Detect best supported format — iOS Safari only supports mp4/aac
      let mimeType = "";
      const candidates = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/aac",
        "audio/ogg;codecs=opus",
      ];
      for (const candidate of candidates) {
        try {
          if (MediaRecorder.isTypeSupported(candidate)) {
            mimeType = candidate;
            break;
          }
        } catch {
          // isTypeSupported can throw on some browsers
        }
      }

      const recorderOptions: MediaRecorderOptions = {};
      if (mimeType) recorderOptions.mimeType = mimeType;

      const recorder = new MediaRecorder(stream, recorderOptions);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        stopRecordingTimer();

        if (chunksRef.current.length === 0) {
          setError("No se grabó audio");
          return;
        }

        const actualMime = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: actualMime });

        console.log(`[Audio] ${chunksRef.current.length} chunks, ${blob.size} bytes, type: ${actualMime}`);

        if (blob.size < 100) {
          setError("Audio muy corto, intenta de nuevo");
          return;
        }

        setTranscribing(true);
        try {
          const transcribed = await onTranscribe(blob);
          if (transcribed) {
            const newText = text ? text + " " + transcribed : transcribed;
            setEditorContent(newText);
            editorRef.current?.focus();
          } else {
            setError("No se detectó texto");
          }
        } catch (err) {
          console.error("Transcription error:", err);
          const msg = err instanceof Error ? err.message : "Error al transcribir";
          setError(msg);
        } finally {
          setTranscribing(false);
        }
      };

      recorder.onerror = (e) => {
        console.error("MediaRecorder error:", e);
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        stopRecordingTimer();
        setError("Error al grabar");
      };

      // Auto-stop after 60 seconds
      setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, 60000);

      // Start recording — NO timeslice (more compatible across browsers)
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
      startRecordingTimer();
      if (navigator.vibrate) navigator.vibrate(15);
    } catch (err) {
      console.error("getUserMedia error:", err);
      setError("No se pudo acceder al micrófono");
    }
  };

  const hasContent = text.trim().length > 0 || !!imageBase64;
  const isDisabled = disabled || transcribing;

  return (
    <div className="input-bar-bg safe-bottom">
      {/* Error toast */}
      {error && (
        <div className="mx-3 mb-1 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-500 text-center animate-fade-in">
          {error}
        </div>
      )}

      {/* Image preview */}
      {imagePreview && (
        <div className="px-4 pt-2 pb-1">
          <div className="relative inline-block">
            <img
              src={imagePreview}
              alt="Preview"
              className="h-20 w-auto rounded-2xl object-cover border border-white/10 shadow-sm"
            />
            <button
              onClick={clearImage}
              className="absolute -top-2 -right-2 w-6 h-6 bg-gray-900/80 dark:bg-white/80 text-white dark:text-gray-900 rounded-full flex items-center justify-center active:scale-90 shadow-sm"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Recording indicator */}
      {recording && (
        <div className="flex items-center gap-2 px-4 py-2 animate-fade-in">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-gentle-pulse" />
          <span className="text-xs font-medium text-red-500">Grabando {formatTime(recordingTime)}</span>
          <div className="flex-1" />
          <button
            onClick={toggleRecording}
            className="text-xs text-red-500 font-medium px-3 py-1 rounded-full bg-red-50 dark:bg-red-950/30 active:scale-95"
          >
            Detener
          </button>
        </div>
      )}

      {/* Input row */}
      <div className="flex items-end gap-2 px-2 py-1.5">
        {/* Input container with + and camera inside */}
        <div className="flex-1 flex items-end bg-gray-100 dark:bg-[#2c2c2e] rounded-[22px] min-h-[44px] overflow-hidden">
          {/* Plus / gallery button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isDisabled}
            className="flex-shrink-0 w-11 h-[44px] flex items-center justify-center text-gray-500 dark:text-gray-400 active:scale-90 disabled:opacity-40"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
          />

          {/* ContentEditable input — NO accessory bar on iOS */}
          <div
            ref={editorRef}
            contentEditable={!isDisabled}
            role="textbox"
            data-placeholder={transcribing ? "Transcribiendo..." : placeholder}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onPaste={handlePaste}
            className="flex-1 py-[11px] text-[16px] leading-[22px] max-h-[120px] overflow-y-auto text-gray-900 dark:text-gray-100"
          />

          {/* Camera button (inside input pill) */}
          <button
            onClick={() => {
              // Create a separate camera-only input
              const input = document.createElement("input");
              input.type = "file";
              input.accept = "image/*";
              input.capture = "environment";
              input.onchange = (e) => {
                const target = e.target as HTMLInputElement;
                const file = target.files?.[0];
                if (!file) return;
                if (file.size > MAX_IMAGE_SIZE) {
                  setError("Imagen muy grande (máx 5MB)");
                  return;
                }
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
            className="flex-shrink-0 w-10 h-[44px] flex items-center justify-center text-gray-500 dark:text-gray-400 active:scale-90 disabled:opacity-40"
          >
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </button>
        </div>

        {/* Right action button: Send or Mic */}
        {hasContent ? (
          <button
            onClick={handleSubmit}
            disabled={isDisabled}
            className={`flex-shrink-0 w-[44px] h-[44px] rounded-full flex items-center justify-center active:scale-90 disabled:opacity-50 transition-all duration-300 ${
              agent === "kronos"
                ? "bg-[#bcd431] text-[#0f0f11] active:bg-[#9ab321] shadow-md shadow-[#bcd431]/30"
                : "bg-[#bcd431] text-[#3d1e54] active:bg-[#9ab321]"
            }`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        ) : (
          <button
            onClick={toggleRecording}
            disabled={isDisabled}
            className={`flex-shrink-0 w-[44px] h-[44px] rounded-full flex items-center justify-center transition-all duration-300 active:scale-90 ${
              recording
                ? "bg-red-500 text-white animate-gentle-pulse"
                : transcribing
                  ? agent === "kronos"
                    ? "bg-[#bcd431]/20 text-[#bcd431]"
                    : "bg-[#572c77]/20 text-[#572c77]"
                  : agent === "kronos"
                    ? "bg-[#bcd431] text-[#0f0f11] shadow-md shadow-[#bcd431]/30"
                    : "bg-[#572c77] text-white"
            } disabled:opacity-50`}
          >
            {transcribing ? (
              <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : recording ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
