import { useState, useEffect, useRef, useCallback } from "react";
import { fetchImages, deleteImage, type GalleryImage } from "@/lib/api";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { motion } from "framer-motion";
import { ChevronLeft, Image as ImageIcon, Trash2, Loader2 } from "lucide-react";

interface Props {
  onClose: () => void;
  onImageClick?: (src: string) => void;
}

const PAGE_SIZE = 24;

function imageSrcFromBase64(base64: string): string {
  const mime = base64.startsWith("iVBOR") ? "image/png"
    : base64.startsWith("R0lGOD") ? "image/gif"
    : base64.startsWith("UklGR") ? "image/webp"
    : "image/jpeg";
  return `data:${mime};base64,${base64}`;
}

const thumbCache = new Map<string, string>();
const supportsWebP = document.createElement("canvas").toDataURL("image/webp").startsWith("data:image/webp");

function getThumbnail(id: string, base64: string): Promise<string> {
  const cached = thumbCache.get(id);
  if (cached) return Promise.resolve(cached);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const MAX = 320;
      const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
      const w = Math.round(img.width * ratio);
      const h = Math.round(img.height * ratio);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (ctx) { ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high"; ctx.drawImage(img, 0, 0, w, h); }
      const thumb = supportsWebP ? canvas.toDataURL("image/webp", 0.78) : canvas.toDataURL("image/jpeg", 0.82);
      thumbCache.set(id, thumb);
      resolve(thumb);
    };
    img.onerror = () => resolve(imageSrcFromBase64(base64));
    img.src = imageSrcFromBase64(base64);
  });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffH = (now.getTime() - d.getTime()) / (1000 * 60 * 60);
  if (diffH < 1) return "Hace un momento";
  if (diffH < 24) return `Hace ${Math.floor(diffH)}h`;
  if (diffH < 48) return "Ayer";
  return d.toLocaleDateString("es", { day: "numeric", month: "short" });
}

export function ImageGallery({ onClose, onImageClick }: Props) {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [thumbs, setThumbs] = useState<Map<string, string>>(new Map());
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [contextId, setContextId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);

  useEffect(() => {
    fetchImages()
      .then(setImages)
      .catch((err) => console.error("[ImageGallery] Error:", err))
      .finally(() => setLoading(false));
  }, []);

  // Progressive thumbnails
  useEffect(() => {
    const visible = images.slice(0, visibleCount);
    let cancelled = false;
    (async () => {
      for (const img of visible) {
        if (cancelled || thumbs.has(img.id)) continue;
        const thumb = await getThumbnail(img.id, img.image);
        if (!cancelled) setThumbs((prev) => new Map(prev).set(img.id, thumb));
      }
    })();
    return () => { cancelled = true; };
  }, [images, visibleCount]);

  // Infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisibleCount((p) => Math.min(p + PAGE_SIZE, images.length)); },
      { root: scrollRef.current, rootMargin: "200px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [images.length]);

  const handleLongPressStart = useCallback((id: string) => {
    didLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true;
      if (navigator.vibrate) navigator.vibrate(20);
      setContextId(id);
    }, 500);
  }, []);

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  }, []);

  const handleTap = useCallback((id: string, src: string) => {
    if (didLongPress.current) return;
    if (contextId) { setContextId(null); return; }
    onImageClick?.(src);
  }, [contextId, onImageClick]);

  const handleDelete = useCallback(async (id: string) => {
    setDeleting(true);
    try {
      await deleteImage(id);
      setImages((prev) => prev.filter((img) => img.id !== id));
      setContextId(null);
    } catch {} finally { setDeleting(false); }
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border-subtle bg-bg/80 backdrop-blur-sm">
        <Button variant="ghost" size="icon" className="h-8 w-8 text-text-muted" onClick={onClose}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h2 className="font-semibold text-text text-base">Galería</h2>
          {!loading && images.length > 0 && (
            <p className="text-[11px] text-text-muted -mt-0.5">
              {images.length} {images.length === 1 ? "imagen" : "imágenes"}
            </p>
          )}
        </div>
      </div>

      {/* Content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto bg-bg">
        {loading ? (
          <div className="columns-3 sm:columns-4 gap-1.5 p-2">
            {[...Array(9)].map((_, i) => (
              <Skeleton key={i} className="aspect-square mb-1.5 rounded-xl" />
            ))}
          </div>
        ) : images.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <div className="w-16 h-16 rounded-2xl bg-bg-surface flex items-center justify-center mb-4">
              <ImageIcon className="h-7 w-7 text-text-muted/50" />
            </div>
            <p className="text-sm font-medium text-text-muted">No hay imágenes aún</p>
            <p className="text-xs text-text-muted/60 mt-1">Pídele a Kira que genere una imagen</p>
          </div>
        ) : (
          <div className="columns-3 sm:columns-4 md:columns-5 lg:columns-6 gap-1.5 p-2">
            {images.slice(0, visibleCount).map((img, i) => {
              const thumb = thumbs.get(img.id);
              const fullSrc = imageSrcFromBase64(img.image);
              return (
                <motion.div
                  key={img.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(i * 0.02, 0.3) }}
                  className="relative mb-1.5 break-inside-avoid group/card"
                  onTouchStart={() => handleLongPressStart(img.id)}
                  onTouchEnd={handleLongPressEnd}
                  onTouchCancel={handleLongPressEnd}
                  onClick={() => handleTap(img.id, fullSrc)}
                  onContextMenu={(e) => e.preventDefault()}
                >
                  <div className="rounded-xl overflow-hidden border border-border-subtle transition-transform duration-300 hover:scale-[1.03]">
                    {thumb ? (
                      <img src={thumb} alt="Imagen generada" className="w-full block" decoding="async" draggable={false} />
                    ) : (
                      <div className="w-full aspect-square bg-bg-surface flex items-center justify-center">
                        <Loader2 className="h-5 w-5 text-text-muted animate-spin" />
                      </div>
                    )}
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent pt-5 pb-1 px-1.5 pointer-events-none rounded-b-xl">
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-[8px] text-white/80 font-medium truncate">{formatDate(img.created_at)}</p>
                        {img.engine && (
                          <span className="px-1.5 py-px rounded-full text-[7px] font-medium bg-kira/20 text-kira shrink-0">
                            {img.engine}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Context menu overlay */}
                  {contextId === img.id && (
                    <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center z-10">
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-8 text-xs"
                        disabled={deleting}
                        onClick={(e) => { e.stopPropagation(); handleDelete(img.id); }}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Eliminar
                      </Button>
                    </div>
                  )}
                </motion.div>
              );
            })}
            {visibleCount < images.length && <div ref={sentinelRef} className="w-full h-8" />}
          </div>
        )}
      </div>
    </div>
  );
}
