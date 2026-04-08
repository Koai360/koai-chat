import { useState, useEffect, useCallback, useRef } from "react";
import { Download, Trash2, ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  fetchImages,
  deleteImage,
  getImageThumbUrl,
  type GalleryImage,
} from "@/lib/api";

interface Props {
  onImageClick: (src: string) => void;
}

/**
 * MediaGalleryPage — galería con infinite scroll, thumbnails y cache.
 *
 * Optimizaciones:
 * - Paginación cursor (24 imágenes/batch) en vez de fetch all
 * - Backend filtra solo URLs (no base64 inline) → payload ~14 KB vs ~108 MB
 * - Thumbnails 600px via Supabase Storage transformations (~80-150 KB cada uno)
 * - Cache en módulo (TTL 60s) — evita refetch al volver de otra pantalla
 * - AbortController — cancela fetch si el user navega fuera
 * - Intersection observer al final del grid → siguiente batch sin scroll trick
 * - decoding="async" + loading="lazy" en cada <img>
 */

const PAGE_SIZE = 24;
const CACHE_TTL_MS = 60_000;

// Cache módulo (vive mientras el JS bundle está cargado)
let cache: {
  items: GalleryImage[];
  nextCursor: string | null;
  ts: number;
} | null = null;

export function MediaGalleryPage({ onImageClick }: Props) {
  const [images, setImages] = useState<GalleryImage[]>(() =>
    cache && Date.now() - cache.ts < CACHE_TTL_MS ? cache.items : []
  );
  const [nextCursor, setNextCursor] = useState<string | null>(() =>
    cache && Date.now() - cache.ts < CACHE_TTL_MS ? cache.nextCursor : null
  );
  const [loading, setLoading] = useState<boolean>(() => !cache || Date.now() - cache.ts >= CACHE_TTL_MS);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const loadFirstBatch = useCallback(async () => {
    // Si hay cache válido, usarlo y NO hacer fetch
    if (cache && Date.now() - cache.ts < CACHE_TTL_MS) {
      setImages(cache.items);
      setNextCursor(cache.nextCursor);
      setHasMore(cache.nextCursor !== null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      const page = await fetchImages({
        limit: PAGE_SIZE,
        signal: abortRef.current.signal,
      });
      setImages(page.items);
      setNextCursor(page.next_cursor);
      setHasMore(page.next_cursor !== null);
      cache = { items: page.items, nextCursor: page.next_cursor, ts: Date.now() };
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        console.error("[MediaGallery] Failed to load images:", err);
        setError("No se pudieron cargar las imágenes");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const loadNextBatch = useCallback(async () => {
    if (loadingMore || !hasMore || !nextCursor) return;
    setLoadingMore(true);
    abortRef.current = new AbortController();
    try {
      const page = await fetchImages({
        limit: PAGE_SIZE,
        before: nextCursor,
        signal: abortRef.current.signal,
      });
      setImages((prev) => {
        const merged = [...prev, ...page.items];
        cache = { items: merged, nextCursor: page.next_cursor, ts: Date.now() };
        return merged;
      });
      setNextCursor(page.next_cursor);
      setHasMore(page.next_cursor !== null);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        console.error("[MediaGallery] Failed to load next batch:", err);
      }
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, nextCursor]);

  // Initial load
  useEffect(() => {
    loadFirstBatch();
    return () => {
      abortRef.current?.abort();
    };
  }, [loadFirstBatch]);

  // Intersection observer for infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadNextBatch();
        }
      },
      { rootMargin: "300px" }, // empieza a cargar 300px antes de llegar
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loading, loadNextBatch]);

  const handleRemoveAll = async () => {
    if (!confirm("Eliminar todas las imágenes? No se puede deshacer.")) return;
    try {
      await Promise.all(images.map((img) => deleteImage(img.id)));
      setImages([]);
      setNextCursor(null);
      setHasMore(false);
      cache = null;
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
      setImages((prev) => {
        const filtered = prev.filter((img) => img.id !== id);
        if (cache) {
          cache = { ...cache, items: filtered, ts: Date.now() };
        }
        return filtered;
      });
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

      {/* Content */}
      <ScrollArea className="flex-1">
        {loading ? (
          /* Skeleton — Pinterest style, 6 cards */
          <div className="columns-2 sm:columns-3 lg:columns-4 gap-3 pb-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="mb-3 break-inside-avoid rounded-2xl bg-bg-surface animate-shimmer"
                style={{ height: `${160 + (i % 3) * 50}px` }}
              />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-text-muted">
            <ImageIcon className="size-10 mb-3 opacity-40 text-danger" />
            <p className="text-sm">{error}</p>
            <button
              onClick={loadFirstBatch}
              className="mt-3 text-xs text-kira hover:underline"
            >
              Reintentar
            </button>
          </div>
        ) : images.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-text-muted">
            <ImageIcon className="size-10 mb-3 opacity-40" />
            <p className="text-sm">Aún no hay imágenes</p>
            <p className="text-xs text-text-subtle mt-1">
              Las imágenes que generes aparecerán aquí
            </p>
          </div>
        ) : (
          <>
            {/* Pinterest masonry grid */}
            <div className="columns-2 sm:columns-3 lg:columns-4 gap-3 pb-4">
              {images.map((img) => (
                <div
                  key={img.id}
                  onClick={() => onImageClick(img.image)}
                  className="mb-3 break-inside-avoid relative rounded-2xl overflow-hidden cursor-pointer group bg-bg-surface border border-border"
                >
                  <img
                    src={getImageThumbUrl(img.image, 600)}
                    alt={img.content || "Imagen generada"}
                    className="w-full h-auto object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
                    {img.content && (
                      <p className="text-[11px] text-white/70 line-clamp-2 mb-2">
                        {img.content}
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => handleDownload(e, img.image)}
                        className="p-1.5 rounded-lg liquid-glass text-white hover:text-kira transition-colors"
                        aria-label="Descargar"
                      >
                        <Download className="size-4" />
                      </button>
                      <button
                        onClick={(e) => handleDelete(e, img.id)}
                        className="p-1.5 rounded-lg liquid-glass text-white hover:text-danger transition-colors"
                        aria-label="Eliminar"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Infinite scroll sentinel + loading indicator */}
            {hasMore && (
              <div ref={sentinelRef} className="flex items-center justify-center py-6">
                {loadingMore && (
                  <Loader2 className="size-5 animate-spin text-text-muted" />
                )}
              </div>
            )}

            {/* End of list */}
            {!hasMore && images.length > PAGE_SIZE && (
              <div className="text-center py-4">
                <span className="font-mono text-[10px] text-text-subtle">
                  · fin de la galería ·
                </span>
              </div>
            )}
          </>
        )}
      </ScrollArea>
    </div>
  );
}
