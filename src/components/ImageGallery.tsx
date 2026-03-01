import { useState, useEffect } from "react";
import { fetchImages, type GalleryImage } from "../lib/api";
import { ImageModal } from "./ImageModal";

interface Props {
  onClose: () => void;
}

function imageSrcFromBase64(base64: string): string {
  const mime = base64.startsWith("iVBOR") ? "image/png"
    : base64.startsWith("R0lGOD") ? "image/gif"
    : base64.startsWith("UklGR") ? "image/webp"
    : "image/jpeg";
  return `data:${mime};base64,${base64}`;
}

export function ImageGallery({ onClose }: Props) {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSrc, setSelectedSrc] = useState<string | null>(null);

  useEffect(() => {
    fetchImages()
      .then(setImages)
      .catch((err) => console.error("[ImageGallery] Error:", err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#0a0a0c]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 safe-top">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100">Galería</h2>
        <button
          onClick={onClose}
          className="w-11 h-11 flex items-center justify-center text-gray-500 hover:text-gray-700 rounded-xl"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <svg className="animate-spin w-6 h-6 text-gray-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : images.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-300 dark:text-gray-600 mb-3">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            <p className="text-sm text-gray-400">No hay imágenes generadas aún</p>
            <p className="text-xs text-gray-400 mt-1">Pídele a Kira que genere una imagen</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {images.map((img) => {
              const src = imageSrcFromBase64(img.image);
              return (
                <button
                  key={img.id}
                  onClick={() => setSelectedSrc(src)}
                  className="aspect-square rounded-xl overflow-hidden bg-gray-100 dark:bg-[#1a1a1e] active:scale-95 transition-transform"
                >
                  <img
                    src={src}
                    alt="Imagen generada"
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {images.length > 0 && (
        <p className="text-center text-[11px] text-gray-400 pb-3 safe-bottom">
          {images.length} {images.length === 1 ? "imagen" : "imágenes"}
        </p>
      )}

      {/* Full-size modal */}
      {selectedSrc && (
        <ImageModal imageSrc={selectedSrc} onClose={() => setSelectedSrc(null)} />
      )}
    </div>
  );
}
