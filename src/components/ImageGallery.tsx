import { useState, useEffect } from "react";
import { fetchImages, type GalleryImage } from "../lib/api";

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

  useEffect(() => {
    fetchImages()
      .then(setImages)
      .catch((err) => console.error("[ImageGallery] Error:", err))
      .finally(() => setLoading(false));
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
        <div>
          <h2 className="font-semibold text-gray-100 text-base">Galería</h2>
          {!loading && images.length > 0 && (
            <p className="text-[11px] text-gray-400 -mt-0.5">
              {images.length} {images.length === 1 ? "imagen" : "imágenes"} generadas
            </p>
          )}
        </div>
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
          <div className="columns-2 gap-3 p-3 sm:columns-3 sm:p-4 md:columns-4 lg:columns-5">
            {images.map((img) => {
              const src = imageSrcFromBase64(img.image);
              return (
                <button
                  key={img.id}
                  onClick={() => onImageClick?.(src)}
                  className="block w-full mb-3 break-inside-avoid group"
                >
                  <div className="relative rounded-2xl overflow-hidden bg-[#1a1a1e] shadow-sm hover:shadow-lg hover:scale-[1.02] active:scale-[0.97] transition-all duration-200">
                    <img
                      src={src}
                      alt="Imagen generada"
                      className="w-full block"
                      loading="lazy"
                    />
                    {/* Overlay con fecha + descripción */}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent pt-8 pb-2.5 px-3 opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity duration-200">
                      <p className="text-[11px] text-white/90 font-medium">{formatDate(img.created_at)}</p>
                      {img.content && (
                        <p className="text-[10px] text-white/60 truncate mt-0.5">{img.content}</p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
