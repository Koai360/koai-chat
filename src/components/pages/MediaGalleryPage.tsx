import { useState, useEffect, useCallback, useRef } from "react";
import { ImageIcon, Loader2, EyeOff, Lock } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  fetchImages,
  type GalleryImage,
} from "@/lib/api";
import { getCfTransformUrl } from "@/lib/cfTransform";

interface Props {
  onImageClick: (src: string, imageId?: string, isHidden?: boolean) => void;
  isPrivateUnlocked?: boolean;
}

type GalleryTab = "all" | "private";

const PAGE_SIZE = 24;
const CACHE_TTL_MS = 60_000;

// Cache módulo por tab
const caches: Record<GalleryTab, {
  items: GalleryImage[];
  nextCursor: string | null;
  ts: number;
} | null> = { all: null, private: null };

export function MediaGalleryPage({ onImageClick, isPrivateUnlocked = false }: Props) {
  const [activeTab, setActiveTab] = useState<GalleryTab>("all");
  const [images, setImages] = useState<GalleryImage[]>(() => {
    const c = caches[activeTab];
    return c && Date.now() - c.ts < CACHE_TTL_MS ? c.items : [];
  });
  const [nextCursor, setNextCursor] = useState<string | null>(() => {
    const c = caches[activeTab];
    return c && Date.now() - c.ts < CACHE_TTL_MS ? c.nextCursor : null;
  });
  const [loading, setLoading] = useState<boolean>(() => {
    const c = caches[activeTab];
    return !c || Date.now() - c.ts >= CACHE_TTL_MS;
  });
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const loadFirstBatch = useCallback(async (tab: GalleryTab) => {
    const c = caches[tab];
    if (c && Date.now() - c.ts < CACHE_TTL_MS) {
      setImages(c.items);
      setNextCursor(c.nextCursor);
      setHasMore(c.nextCursor !== null);
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
        hidden: tab === "private",
        signal: abortRef.current.signal,
      });
      setImages(page.items);
      setNextCursor(page.next_cursor);
      setHasMore(page.next_cursor !== null);
      caches[tab] = { items: page.items, nextCursor: page.next_cursor, ts: Date.now() };
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
        hidden: activeTab === "private",
        signal: abortRef.current.signal,
      });
      setImages((prev) => {
        const merged = [...prev, ...page.items];
        caches[activeTab] = { items: merged, nextCursor: page.next_cursor, ts: Date.now() };
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
  }, [loadingMore, hasMore, nextCursor, activeTab]);

  // Load on mount and tab switch
  useEffect(() => {
    loadFirstBatch(activeTab);
    return () => {
      abortRef.current?.abort();
    };
  }, [activeTab, loadFirstBatch]);

  // Listen for deletes
  useEffect(() => {
    const handler = (e: Event) => {
      const id = (e as CustomEvent<{ id: string }>).detail?.id;
      if (!id) return;
      setImages((prev) => {
        const filtered = prev.filter((img) => img.id !== id);
        if (caches[activeTab]) caches[activeTab] = { ...caches[activeTab]!, items: filtered, ts: Date.now() };
        return filtered;
      });
    };
    window.addEventListener("gallery-image-deleted", handler);
    return () => window.removeEventListener("gallery-image-deleted", handler);
  }, [activeTab]);

  // Listen for hide/show — move image between tabs
  useEffect(() => {
    const handler = (e: Event) => {
      const { id, hidden } = (e as CustomEvent<{ id: string; hidden: boolean }>).detail || {};
      if (!id) return;
      // Remove from current tab's list
      setImages((prev) => {
        const filtered = prev.filter((img) => img.id !== id);
        if (caches[activeTab]) caches[activeTab] = { ...caches[activeTab]!, items: filtered, ts: Date.now() };
        return filtered;
      });
      // Invalidate the other tab's cache
      const otherTab = hidden ? "private" : "all";
      caches[otherTab] = null;
    };
    window.addEventListener("gallery-image-hidden", handler);
    return () => window.removeEventListener("gallery-image-hidden", handler);
  }, [activeTab]);

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
      { rootMargin: "300px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loading, loadNextBatch]);

  // If private mode gets locked while on private tab, switch to all
  useEffect(() => {
    if (activeTab === "private" && !isPrivateUnlocked) {
      setActiveTab("all");
    }
  }, [isPrivateUnlocked, activeTab]);

  const isPrivate = activeTab === "private";

  return (
    <div className="flex flex-col h-full px-4 pt-4 pb-2">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-medium text-text font-display animate-fadeUpBlur">
          Galería
        </h1>

        {/* Tabs — solo mostrar si hay PIN y está desbloqueado */}
        {isPrivateUnlocked && (
          <div className="flex gap-1 mt-3 bg-white/[0.04] rounded-lg p-1">
            <button
              onClick={() => setActiveTab("all")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition-all ${
                activeTab === "all"
                  ? "bg-white/[0.08] text-text"
                  : "text-text-muted hover:text-text"
              }`}
            >
              Todas
            </button>
            <button
              onClick={() => setActiveTab("private")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition-all ${
                activeTab === "private"
                  ? "bg-white/[0.08] text-text"
                  : "text-text-muted hover:text-text"
              }`}
            >
              <Lock className="size-3" />
              Privada
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        {loading ? (
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
              onClick={() => loadFirstBatch(activeTab)}
              className="mt-3 text-xs text-noa hover:underline"
            >
              Reintentar
            </button>
          </div>
        ) : images.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-text-muted">
            {isPrivate ? (
              <>
                <EyeOff className="size-10 mb-3 opacity-40" />
                <p className="text-sm">No hay imágenes ocultas</p>
                <p className="text-xs text-text-subtle mt-1">
                  Usa el botón "Ocultar" en cualquier imagen
                </p>
              </>
            ) : (
              <>
                <ImageIcon className="size-10 mb-3 opacity-40" />
                <p className="text-sm">Aún no hay imágenes</p>
                <p className="text-xs text-text-subtle mt-1">
                  Las imágenes que generes aparecerán aquí
                </p>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="columns-2 sm:columns-3 lg:columns-4 gap-3 pb-4">
              {images.map((img) => (
                <div
                  key={img.id}
                  onClick={() => onImageClick(img.image, img.id, img.is_hidden)}
                  className="mb-3 break-inside-avoid relative rounded-2xl overflow-hidden cursor-pointer group bg-bg-surface border border-border"
                >
                  <img
                    src={getCfTransformUrl(img.image, "thumb")}
                    alt={img.content || "Imagen generada"}
                    className="w-full h-auto object-cover"
                    loading="lazy"
                    decoding="async"
                  />

                  {/* Hidden badge for private tab */}
                  {isPrivate && (
                    <div className="absolute top-2 left-2">
                      <div className="w-6 h-6 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
                        <EyeOff className="size-3 text-white/70" />
                      </div>
                    </div>
                  )}

                  {/* Prompt caption on hover (desktop) */}
                  {img.content && (
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-3 pt-8 pointer-events-none">
                      <p className="text-[11px] text-white/85 line-clamp-2">
                        {img.content}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {hasMore && (
              <div ref={sentinelRef} className="flex items-center justify-center py-6">
                {loadingMore && (
                  <Loader2 className="size-5 animate-spin text-text-muted" />
                )}
              </div>
            )}

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
