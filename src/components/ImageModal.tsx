import { useCallback, useRef, useState, useEffect } from "react";

interface Props {
  imageSrc: string;
  onClose: () => void;
}

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

  // Generate optimized display version on mount
  useEffect(() => {
    setDisplaySrc(null);
    createDisplayVersion(imageSrc).then(setDisplaySrc);
  }, [imageSrc]);

  // Download the ORIGINAL full-res image
  const handleDownload = useCallback(() => {
    const link = document.createElement("a");
    link.href = imageSrc;
    link.download = `koai-image-${Date.now()}.png`;
    link.click();
  }, [imageSrc]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    translateY.current = 0;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const diff = e.touches[0].clientY - touchStartY.current;
    if (diff > 0 && imgRef.current) {
      translateY.current = diff;
      imgRef.current.style.transform = `translateY(${diff}px)`;
      imgRef.current.style.opacity = `${Math.max(0.3, 1 - diff / 400)}`;
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (translateY.current > 120) {
      onClose();
    } else if (imgRef.current) {
      imgRef.current.style.transform = "";
      imgRef.current.style.opacity = "";
    }
    translateY.current = 0;
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[80] bg-black/95 flex flex-col animate-fade-in">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 safe-top">
        <button
          onClick={onClose}
          className="w-10 h-10 flex items-center justify-center rounded-full text-white/70 active:text-white active:bg-white/10"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 text-white/80 text-sm active:bg-white/20 active:scale-95 transition-all"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Descargar HD
        </button>
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
            className="max-w-full max-h-full object-contain rounded-lg"
            decoding="async"
          />
        ) : (
          <svg className="animate-spin w-8 h-8 text-white/50" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
      </div>

      {/* Hint */}
      <p className="text-center text-xs text-white/30 pb-4 safe-bottom">
        Desliza hacia abajo para cerrar
      </p>
    </div>
  );
}
