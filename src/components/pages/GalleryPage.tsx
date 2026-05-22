import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Image as ImageIcon, X } from "lucide-react";
import { listImages, fetchRatingsMap } from "@/lib/api";
import { Skeleton } from "@/components/ui/Skeleton";
import type { ChatImage } from "@/types/api";
import { cn } from "@/lib/cn";

/**
 * GalleryPage — masonry de imágenes generadas + viewer modal.
 *
 * Implementation:
 * - Infinite scroll con cursor del backend
 * - 2-4 columnas según viewport
 * - Click → modal full-screen
 * - Skeleton mientras carga primera page
 */
export function GalleryPage() {
  const [items, setItems] = useState<ChatImage[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [modalImage, setModalImage] = useState<ChatImage | null>(null);
  const observerRef = useRef<HTMLDivElement>(null);

  const loadPage = useCallback(
    async (before?: string) => {
      try {
        const { items: newItems, next_cursor } = await listImages({ limit: 24, before });
        setItems((prev) => (before ? [...prev, ...newItems] : newItems));
        setCursor(next_cursor || null);
        if (!next_cursor) setDone(true);
      } catch (err) {
        console.warn("[GalleryPage] load failed", err);
        setDone(true);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    loadPage();
    fetchRatingsMap()
      .then(setRatings)
      .catch(() => {});
  }, [loadPage]);

  // Infinite scroll
  useEffect(() => {
    if (!observerRef.current || done || loading) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && cursor) {
          setLoading(true);
          loadPage(cursor);
        }
      },
      { threshold: 0.1 },
    );
    obs.observe(observerRef.current);
    return () => obs.disconnect();
  }, [cursor, done, loading, loadPage]);

  return (
    <div className="h-full flex flex-col">
      <header className="px-6 pt-6 pb-3">
        <h1 className="display text-[24px] md:text-[28px] font-semibold text-white mb-1">
          Galería
        </h1>
        <p className="text-sm text-white/45">
          {items.length > 0 ? `${items.length} imágenes` : "Imágenes generadas"}
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-3 md:px-6 pb-6">
        {items.length === 0 && loading ? (
          <SkeletonGrid />
        ) : items.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3">
            {items.map((img) => (
              <GalleryTile
                key={img.id}
                image={img}
                rating={ratings[img.id]}
                onClick={() => setModalImage(img)}
              />
            ))}
            {!done && (
              <div ref={observerRef} className="col-span-full h-20 flex items-center justify-center">
                {loading && <Skeleton width={100} height={12} className="rounded-full" />}
              </div>
            )}
          </div>
        )}
      </div>

      {modalImage && <ImageViewer image={modalImage} onClose={() => setModalImage(null)} />}
    </div>
  );
}

function GalleryTile({
  image,
  rating,
  onClick,
}: {
  image: ChatImage;
  rating?: number;
  onClick: () => void;
}) {
  // Reescribimos URL si es Supabase storage para servir thumb (regla S104)
  const thumbUrl =
    image.url.includes("/storage/v1/object/public/")
      ? image.url.replace(
          "/storage/v1/object/public/",
          "/storage/v1/render/image/public/?width=600&quality=85&resize=contain&path=",
        )
      : image.url;

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      onClick={onClick}
      className={cn(
        "group relative aspect-square rounded-xl overflow-hidden",
        "bg-[var(--color-bg-elevated)] border border-white/[0.06]",
        "hover:border-white/[0.16] transition-colors",
      )}
    >
      <img
        src={thumbUrl}
        alt={image.prompt || ""}
        loading="lazy"
        className="w-full h-full object-cover"
      />
      {rating && rating > 0 && (
        <div className="absolute top-1.5 right-1.5 bg-black/70 backdrop-blur-sm rounded-full px-1.5 py-0.5 text-[10px] text-white mono">
          ★ {rating}
        </div>
      )}
    </motion.button>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3">
      {Array.from({ length: 12 }).map((_, i) => (
        <Skeleton key={i} variant="rect" className="aspect-square rounded-xl" />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <ImageIcon className="size-12 text-white/20 mb-3" />
      <h2 className="text-lg text-white/85 mb-1">Sin imágenes aún</h2>
      <p className="text-sm text-white/45 max-w-sm">
        Pedile a Noa que genere algo: "dibuja un dashboard premium", "una mascota origami", etc.
      </p>
    </div>
  );
}

function ImageViewer({ image, onClose }: { image: ChatImage; onClose: () => void }) {
  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 size-10 rounded-full bg-white/[0.08] hover:bg-white/[0.16] flex items-center justify-center transition"
        aria-label="Cerrar"
      >
        <X className="size-5 text-white" />
      </button>
      <img
        src={image.url}
        alt={image.prompt || ""}
        className="max-w-full max-h-full object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
      />
    </motion.div>
  );
}
