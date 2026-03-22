import { useState, useEffect, useCallback } from "react";
import { Download, Trash2, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { fetchImages, deleteImage, type GalleryImage } from "@/lib/api";

interface Props {
  onImageClick: (src: string) => void;
}

export function MediaGalleryPage({ onImageClick }: Props) {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);

  const loadImages = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchImages();
      setImages(data);
    } catch (err) {
      console.error("[MediaGallery] Failed to load images:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadImages();
  }, [loadImages]);

  const handleRemoveAll = async () => {
    if (!confirm("Eliminar todas las imágenes? No se puede deshacer.")) return;
    try {
      await Promise.all(images.map((img) => deleteImage(img.id)));
      setImages([]);
    } catch (err) {
      console.error("[MediaGallery] Failed to remove all:", err);
    }
  };

  const handleDownload = async (e: React.MouseEvent, url: string) => {
    e.stopPropagation();
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `kira-image-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      window.open(url, "_blank");
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await deleteImage(id);
      setImages((prev) => prev.filter((img) => img.id !== id));
    } catch (err) {
      console.error("[MediaGallery] Failed to delete:", err);
    }
  };

  return (
    <div className="flex flex-col h-full px-4 pt-4 pb-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-medium text-text font-display animate-fadeUpBlur">
          Galería
        </h1>

        {images.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRemoveAll}
            className="text-danger hover:text-danger text-xs"
          >
            <Trash2 className="size-3.5 mr-1" />
            Eliminar todo
          </Button>
        )}
      </div>

      {/* Content — Pinterest Masonry */}
      <ScrollArea className="flex-1">
        {loading ? (
          /* Shimmer skeleton — Pinterest style */
          <div className="columns-2 sm:columns-3 lg:columns-4 gap-3 pb-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="mb-3 break-inside-avoid rounded-2xl bg-bg-surface animate-shimmer"
                style={{ height: `${150 + (i % 3) * 60}px` }}
              />
            ))}
          </div>
        ) : images.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-text-muted">
            <ImageIcon className="size-10 mb-3 opacity-40" />
            <p className="text-sm">Aún no hay imágenes</p>
            <p className="text-xs text-text-subtle mt-1">Las imágenes que generes aparecerán aquí</p>
          </div>
        ) : (
          /* Pinterest masonry grid */
          <div className="columns-2 sm:columns-3 lg:columns-4 gap-3 pb-4">
            {images.map((img) => (
              <div
                key={img.id}
                onClick={() => onImageClick(img.image)}
                className="mb-3 break-inside-avoid relative rounded-2xl overflow-hidden cursor-pointer group bg-bg-surface border border-border"
              >
                <img
                  src={img.image}
                  alt={img.content || "Imagen generada"}
                  className="w-full h-auto object-cover"
                  loading="lazy"
                />
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
                  {/* Prompt text */}
                  {img.content && (
                    <p className="text-[11px] text-white/70 line-clamp-2 mb-2">
                      {img.content}
                    </p>
                  )}
                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => handleDownload(e, img.image)}
                      className="p-1.5 rounded-lg liquid-glass text-white hover:text-kira transition-colors"
                    >
                      <Download className="size-4" />
                    </button>
                    <button
                      onClick={(e) => handleDelete(e, img.id)}
                      className="p-1.5 rounded-lg liquid-glass text-white hover:text-danger transition-colors"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
