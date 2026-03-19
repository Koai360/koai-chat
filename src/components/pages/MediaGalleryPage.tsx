import { useState, useEffect, useCallback } from "react";
import { Download, Trash2, ImageIcon, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { fetchImages, deleteImage, type GalleryImage } from "@/lib/api";

interface Props {
  onImageClick: (src: string) => void;
}

type Tab = "images" | "videos";

export function MediaGalleryPage({ onImageClick }: Props) {
  const [tab, setTab] = useState<Tab>("images");
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
    if (!confirm("Remove all images? This cannot be undone.")) return;
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

  return (
    <div className="flex flex-col h-full px-4 pt-4 pb-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        {/* Tab pills */}
        <div className="flex items-center gap-1 bg-bg-elevated rounded-lg p-1">
          {(["images", "videos"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
                tab === t
                  ? "bg-bg-surface text-text font-medium"
                  : "text-text-muted hover:text-text"
              }`}
            >
              {t === "images" ? <ImageIcon className="size-3.5" /> : <Film className="size-3.5" />}
              <span className="font-display">{t === "images" ? "Images" : "Videos"}</span>
            </button>
          ))}
        </div>

        {tab === "images" && images.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRemoveAll}
            className="text-danger hover:text-danger text-xs"
          >
            <Trash2 className="size-3.5 mr-1" />
            Remove All
          </Button>
        )}
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        {tab === "videos" ? (
          <div className="flex flex-col items-center justify-center py-20 text-text-muted">
            <Film className="size-10 mb-3 opacity-40" />
            <p className="text-sm">No videos yet</p>
          </div>
        ) : loading ? (
          /* Shimmer skeleton */
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 pb-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="aspect-square rounded-xl bg-bg-surface animate-shimmer"
              />
            ))}
          </div>
        ) : images.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-text-muted">
            <ImageIcon className="size-10 mb-3 opacity-40" />
            <p className="text-sm">No media yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 pb-4">
            {images.map((img) => (
              <div
                key={img.id}
                onClick={() => onImageClick(img.image)}
                className="relative aspect-square rounded-xl overflow-hidden cursor-pointer group border border-border"
              >
                <img
                  src={img.image}
                  alt={img.content || "Generated image"}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-start justify-end p-2">
                  <button
                    onClick={(e) => handleDownload(e, img.image)}
                    className="p-1.5 rounded-lg bg-black/50 text-white hover:bg-black/70 transition-colors"
                  >
                    <Download className="size-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
