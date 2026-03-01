import { useState, useRef, useEffect, useCallback } from "react";

interface Props {
  onSend: (text: string, imageBase64?: string) => void;
  onTranscribe: (blob: Blob) => Promise<string>;
  disabled?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

export function ChatInput({ onSend, onTranscribe, disabled, placeholder = "Escribe un mensaje...", autoFocus }: Props) {
  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null); // data URL for preview
  const [imageBase64, setImageBase64] = useState<string | null>(null); // raw base64 for API
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 120) + "px";
    }
  }, [text]);

  // Auto-focus when requested
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [autoFocus]);

  // Scroll input into view when keyboard opens
  const handleFocus = useCallback(() => {
    setTimeout(() => {
      textareaRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 300);
  }, []);

  const handleSubmit = () => {
    if ((!text.trim() && !imageBase64) || disabled) return;
    if (navigator.vibrate) navigator.vibrate(10);
    onSend(text, imageBase64 || undefined);
    setText("");
    setImagePreview(null);
    setImageBase64(null);
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

  // --- Image handling ---
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_IMAGE_SIZE) {
      alert("Imagen demasiado grande (max 5MB)");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setImagePreview(dataUrl);
      // Extract raw base64 (remove "data:image/...;base64," prefix)
      const base64 = dataUrl.split(",")[1];
      setImageBase64(base64);
    };
    reader.readAsDataURL(file);

    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  const clearImage = () => {
    setImagePreview(null);
    setImageBase64(null);
  };

  // --- Audio recording ---
  const toggleRecording = async () => {
    if (recording) {
      // Stop recording
      mediaRecorderRef.current?.stop();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Prefer webm, fallback to mp4 (Safari)
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/mp4";

      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);

        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (blob.size < 1000) return; // Too short, ignore

        setTranscribing(true);
        try {
          const transcribed = await onTranscribe(blob);
          if (transcribed) {
            setText((prev) => (prev ? prev + " " + transcribed : transcribed));
            textareaRef.current?.focus();
          }
        } catch (err) {
          console.error("Transcription error:", err);
        } finally {
          setTranscribing(false);
        }
      };

      // Auto-stop after 60 seconds
      setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, 60000);

      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
      if (navigator.vibrate) navigator.vibrate(15);
    } catch {
      // Permission denied or no microphone
      alert("No se pudo acceder al micrófono");
    }
  };

  const hasContent = text.trim().length > 0 || !!imageBase64;
  const isDisabled = disabled || transcribing;

  return (
    <div className="bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 safe-bottom">
      {/* Image preview */}
      {imagePreview && (
        <div className="px-3 pt-2 flex items-start gap-2">
          <div className="relative">
            <img
              src={imagePreview}
              alt="Preview"
              className="w-16 h-16 rounded-xl object-cover border border-gray-200 dark:border-gray-700"
            />
            <button
              onClick={clearImage}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-800 rounded-full flex items-center justify-center text-xs active:scale-90"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Input row */}
      <div className="flex items-end gap-1.5 px-2 py-2 sm:px-3 sm:py-2.5">
        {/* Camera/image button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isDisabled}
          className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors active:scale-90 disabled:opacity-40"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleImageSelect}
          className="hidden"
        />

        {/* Text input */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          placeholder={transcribing ? "Transcribiendo..." : placeholder}
          disabled={isDisabled}
          rows={1}
          inputMode="text"
          enterKeyHint="send"
          className="flex-1 resize-none rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 px-4 py-2.5 text-[16px] sm:text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-300 dark:focus:border-indigo-600 transition-all"
        />

        {/* Send or Mic button */}
        {hasContent ? (
          <button
            onClick={handleSubmit}
            disabled={isDisabled}
            className="flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-90 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-md shadow-indigo-500/30 disabled:opacity-50"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        ) : (
          <button
            onClick={toggleRecording}
            disabled={isDisabled}
            className={`flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-90 ${
              recording
                ? "bg-red-500 text-white shadow-md shadow-red-500/30 animate-gentle-pulse"
                : transcribing
                  ? "bg-amber-100 dark:bg-amber-900/30 text-amber-500"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            } disabled:opacity-50`}
          >
            {transcribing ? (
              <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
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
