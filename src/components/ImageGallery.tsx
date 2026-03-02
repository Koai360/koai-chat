import { useState, useEffect, useRef, useCallback } from "react";
import { fetchImages, deleteImage, type GalleryImage } from "../lib/api";

interface Props {
  onClose: () => void;
  onImageClick?: (src: string) => void;
}

function imageSrcFromBase64(base64: string): string {
  const mime = base64.startsWith("iVBOR") ? "image/png"
    : base64.startsWith("R0lGOD") ? "image/gif"
    : base64.startsWith("UklGR") ? "image/webp"
    : "image/jpeg";
  return `data:${mime};base64,${base64}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffH = diffMs / (1000 * 60 * 60);
  if (diffH < 1) return "Hace un momento";
  if (diffH < 24) return `Hace ${Math.floor(diffH)}h`;
  if (diffH < 48) return "Ayer";
  return d.toLocaleDateString("es", { day: "numeric", month: "short" });
}

export function ImageGallery({ onClose, onImageClick }: Props) {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);

  useEffect(() => {
    fetchImages()
      .then(setImages)
      .catch((err) => console.error("[ImageGallery] Error:", err))
      .finally(() => setLoading(false));
  }, []);

  // Close selection on outside tap
  useEffect(() => {
    if (!selectedId) return;
    const handle = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-gallery-item]")) {
        setSelectedId(null);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [selectedId]);

  const handleLongPressStart = useCallback((id: string) => {
    didLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true;
      if (navigator.vibrate) navigator.vibrate(20);
      setSelectedId(id);
    }, 500);
  }, []);

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleTap = useCallback((id: string, src: string) => {
    if (didLongPress.current) return;
    if (selectedId === id) {
      setSelectedId(null);
    } else if (selectedId) {
      setSelectedId(null);
    } else {
      onImageClick?.(src);
    }
  }, [selectedId, onImageClick]);

  const handleDelete = useCallback(async (id: string) => {
    setDeleting(true);
    try {
      await deleteImage(id);
      setImages((prev) => prev.filter((img) => img.id !== id));
      setSelectedId(null);
    } catch (err) {
      console.error("[ImageGallery] Delete error:", err);
    } finally {
      setDeleting(false);
    }
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800 bg-[#0a0a0c]">
        <button
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-200 rounded-xl active:scale-95 transition-all"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="flex-1">
          <h2 className="font-semibold text-gray-100 text-base">Galería</h2>
          {!loading && images.length > 0 && (
            <p className="text-[11px] text-gray-400 -mt-0.5">
              {images.length} {images.length === 1 ? "imagen" : "imágenes"}
            </p>
          )}
        </div>
        {selectedId && (
          <button
            onClick={() => setSelectedId(null)}
            className="text-xs text-gray-400 px-3 py-1.5 rounded-full bg-white/5 active:scale-95"
          >
            Cancelar
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-[#0a0a0c]">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <svg className="animate-spin w-7 h-7 text-[#572c77]" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-sm text-gray-400">Cargando galería...</p>
          </div>
        ) : images.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <div className="w-16 h-16 rounded-2xl bg-[#1a1a1e] flex items-center justify-center mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-600">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-400">No hay imágenes aún</p>
            <p className="text-xs text-gray-400 mt-1">Pídele a Kira que genere una imagen</p>
          </div>
        ) : (
          <div className="columns-3 gap-1.5 p-1.5">
            {images.map((img) => {
              const src = imageSrcFromBase64(img.image);
              const isSelected = selectedId === img.id;
              return (
                <div
                  key={img.id}
                  data-gallery-item
                  className="relative mb-1.5 break-inside-avoid"
                  onTouchStart={() => handleLongPressStart(img.id)}
                  onTouchEnd={handleLongPressEnd}
                  onTouchCancel={handleLongPressEnd}
                  onMouseDown={() => handleLongPressStart(img.id)}
                  onMouseUp={handleLongPressEnd}
                  onMouseLeave={handleLongPressEnd}
                  onClick={() => handleTap(img.id, src)}
                >
                  <img
                    src={src}
                    alt="Imagen generada"
                    className={`w-full block rounded-lg transition-all duration-200 ${
                      isSelected ? "brightness-50 scale-95" : "brightness-100"
                    }`}
                    loading="lazy"
                    draggable={false}
                  />
                  {/* Date overlay — always visible */}
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent pt-6 pb-1 px-1.5 pointer-events-none">
                    <p className="text-[9px] text-white/80 font-medium">{formatDate(img.created_at)}</p>
                  </div>
                  {/* Selected state — delete button */}
                  {isSelected && (
                    <div
                      className="absolute inset-0 flex items-center justify-center animate-fade-in"
                      onTouchStart={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(img.id);
                        }}
                        disabled={deleting}
                        className="flex flex-col items-center gap-1.5 px-4 py-3 rounded-2xl bg-red-500/90 text-white active:scale-90 transition-transform disabled:opacity-50"
                      >
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                        <span className="text-[11px] font-semibold">Eliminar</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
