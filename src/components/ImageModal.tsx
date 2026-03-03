import { useCallback, useRef, useState, useEffect } from "react";
import { MaskEditor } from "./MaskEditor";
import { editImage, saveEditedImage } from "../lib/api";
import type { EditEngine } from "../lib/api";

interface Props {
  imageSrc: string;
  onClose: () => void;
}

const ENGINE_INFO: Record<EditEngine, { label: string; hint: string }> = {
  gemini: { label: "Gemini", hint: "Gemini — rápido (~5s), gratis" },
  flux: { label: "Flux", hint: "Flux Kontext — fotorealista (~15s)" },
  studio: { label: "Studio", hint: "StudioFlux — sin filtros, raw (~30-60s)" },
};

// Create a display-optimized version (max 1200px, JPEG 85%)
function createDisplayVersion(src: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const MAX = 1200;
      if (img.width <= MAX && img.height <= MAX) {
        resolve(src); // Already small enough
        return;
      }
      const ratio = Math.min(MAX / img.width, MAX / img.height);
      const w = Math.round(img.width * ratio);
      const h = Math.round(img.height * ratio);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
}

export function ImageModal({ imageSrc, onClose }: Props) {
  const touchStartY = useRef(0);
  const translateY = useRef(0);
  const imgRef = useRef<HTMLDivElement>(null);
  const [displaySrc, setDisplaySrc] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(imageSrc);

  // Quick Edit state
  const [quickEditOpen, setQuickEditOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [engine, setEngine] = useState<EditEngine>("gemini");

  // Generate optimized display version on mount or when currentSrc changes
  useEffect(() => {
    setDisplaySrc(null);
    createDisplayVersion(currentSrc).then(setDisplaySrc);
  }, [currentSrc]);

  // Download the current full-res image
  const handleDownload = useCallback(() => {
    const link = document.createElement("a");
    link.href = currentSrc;
    link.download = `koai-image-${Date.now()}.png`;
    link.click();
  }, [currentSrc]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (quickEditOpen) return;
    touchStartY.current = e.touches[0].clientY;
    translateY.current = 0;
  }, [quickEditOpen]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (quickEditOpen) return;
    const diff = e.touches[0].clientY - touchStartY.current;
    if (diff > 0 && imgRef.current) {
      translateY.current = diff;
      imgRef.current.style.transform = `translateY(${diff}px)`;
      imgRef.current.style.opacity = `${Math.max(0.3, 1 - diff / 400)}`;
    }
  }, [quickEditOpen]);

  const handleTouchEnd = useCallback(() => {
    if (quickEditOpen) return;
    if (translateY.current > 120) {
      onClose();
    } else if (imgRef.current) {
      imgRef.current.style.transform = "";
      imgRef.current.style.opacity = "";
    }
    translateY.current = 0;
  }, [onClose, quickEditOpen]);

  const handleEditorResult = useCallback((resultSrc: string) => {
    setCurrentSrc(resultSrc);
    setEditorMode(false);
    // Auto-save inpaint result to gallery
    const raw = resultSrc.includes(",") ? resultSrc.split(",")[1] : resultSrc;
    saveEditedImage(raw, "Inpainting edit");
  }, []);

  // Quick Edit: send instruction to Gemini or Flux Kontext
  const handleQuickEdit = useCallback(async () => {
    if (!instruction.trim() || editing) return;
    setEditError(null);
    setEditing(true);

    const inst = instruction.trim();

    try {
      const rawBase64 = currentSrc.includes(",") ? currentSrc.split(",")[1] : currentSrc;
      const result = await editImage(rawBase64, inst, engine);

      if (result.error) {
        setEditError(result.error);
      } else if (result.image) {
        const mime = result.image.startsWith("iVBOR") ? "image/png"
          : result.image.startsWith("R0lGOD") ? "image/gif"
          : result.image.startsWith("UklGR") ? "image/webp"
          : "image/jpeg";
        setCurrentSrc(`data:${mime};base64,${result.image}`);
        setInstruction("");
        // Auto-save to gallery
        saveEditedImage(result.image, inst);
      } else {
        setEditError("No se recibió imagen de resultado");
      }
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setEditing(false);
    }
  }, [instruction, editing, currentSrc, engine]);

  // Show MaskEditor when in editor mode
  if (editorMode) {
    return (
      <MaskEditor
        imageSrc={currentSrc}
        onClose={() => setEditorMode(false)}
        onResult={handleEditorResult}
      />
    );
  }

  const { label: engineLabel, hint: engineHint } = ENGINE_INFO[engine];

  return (
    <div className="fixed inset-0 z-[80] bg-black/95 flex flex-col animate-fade-in">
      {/* Top bar */}
      <div className="flex items-center justify-between px-3 py-3 safe-top">
        <button
          onClick={onClose}
          className="w-10 h-10 flex items-center justify-center rounded-full text-white/70 active:text-white active:bg-white/10"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <div className="flex items-center gap-1.5">
          {/* Quick Edit toggle */}
          <button
            onClick={() => setQuickEditOpen(!quickEditOpen)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-sm active:scale-95 transition-all ${
              quickEditOpen ? "bg-[#bcd431] text-black" : "bg-white/10 text-white/80 active:bg-white/20"
            }`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            Quick Edit
          </button>
          {/* Mask Editor */}
          <button
            onClick={() => setEditorMode(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/10 text-white/80 text-sm active:bg-white/20 active:scale-95 transition-all"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19l7-7 3 3-7 7-3-3z" />
              <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
              <path d="M2 2l7.586 7.586" />
              <circle cx="11" cy="11" r="2" />
            </svg>
            Máscara
          </button>
          {/* Download */}
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/10 text-white/80 text-sm active:bg-white/20 active:scale-95 transition-all"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            HD
          </button>
        </div>
      </div>

      {/* Image */}
      <div
        ref={imgRef}
        className="flex-1 flex items-center justify-center px-4 transition-[transform,opacity] duration-200"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {displaySrc ? (
          <img
            src={displaySrc}
            alt="Imagen generada"
            className={`max-w-full max-h-full object-contain rounded-lg ${editing ? "opacity-50" : ""}`}
            decoding="async"
          />
        ) : (
          <svg className="animate-spin w-8 h-8 text-white/50" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {editing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <svg className="animate-spin w-8 h-8 text-[#bcd431]" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-sm text-white/70">
              Editando con {engineLabel}...
            </p>
          </div>
        )}
      </div>

      {/* Quick Edit panel */}
      {quickEditOpen ? (
        <div className="px-3 pb-3 safe-bottom">
          {editError && (
            <p className="text-xs text-red-400 text-center mb-2">{editError}</p>
          )}
          {/* Engine selector */}
          <div className="flex items-center justify-center gap-2 mb-2">
            {(["gemini", "flux", "studio"] as EditEngine[]).map((eng) => (
              <button
                key={eng}
                onClick={() => setEngine(eng)}
                disabled={editing}
                className={`px-3 py-1.5 rounded-full text-xs transition-all ${
                  engine === eng
                    ? "bg-[#bcd431] text-black"
                    : "bg-white/10 text-white/50 active:bg-white/20"
                }`}
              >
                {ENGINE_INFO[eng].label}
              </button>
            ))}
          </div>
          {/* Input */}
          <div className="flex items-center gap-2 bg-[#2f2f2f] rounded-[22px] px-4 py-2">
            <input
              type="text"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="Ponle un traje azul, cambia el fondo..."
              className="flex-1 bg-transparent text-sm text-[#ececec] placeholder-[#9b9b9b]/60 outline-none"
              disabled={editing}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleQuickEdit();
                }
              }}
            />
            <button
              onClick={handleQuickEdit}
              disabled={editing || !instruction.trim()}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-[#bcd431] text-black shrink-0 disabled:opacity-40 active:scale-95 transition-all"
            >
              {editing ? (
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              )}
            </button>
          </div>
          <p className="text-[10px] text-white/30 text-center mt-1.5">
            {engineHint} · Se guarda en galería
          </p>
        </div>
      ) : (
        <p className="text-center text-xs text-white/30 pb-4 safe-bottom">
          Desliza hacia abajo para cerrar
        </p>
      )}
    </div>
  );
}
