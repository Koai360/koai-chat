import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { ImageIcon, Loader2, EyeOff, Lock, CheckCircle2, Trash2, Archive, ArchiveRestore } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  fetchImages,
  deleteImage,
  hideImage,
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

function useColumnCount() {
  const [cols, setCols] = useState(3);
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      if (w >= 1536) setCols(12);
      else if (w >= 1280) setCols(10);
      else if (w >= 1024) setCols(8);
      else if (w >= 768) setCols(5);
      else if (w >= 640) setCols(4);
      else setCols(3);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return cols;
}

export function MediaGalleryPage({ onImageClick, isPrivateUnlocked = false }: Props) {
  const columnCount = useColumnCount();
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchBusy, setBatchBusy] = useState(false);
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

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelected(new Set());
  }, []);

  const handleBatchDelete = useCallback(async () => {
    if (selected.size === 0 || batchBusy) return;
    if (!confirm(`¿Eliminar ${selected.size} imagen${selected.size > 1 ? "es" : ""}?`)) return;
    setBatchBusy(true);
    try {
      await Promise.all([...selected].map((id) => deleteImage(id)));
      for (const id of selected) {
        window.dispatchEvent(new CustomEvent("gallery-image-deleted", { detail: { id } }));
      }
      exitSelectMode();
    } catch (err) {
      console.error("[Gallery] Batch delete failed:", err);
    } finally {
      setBatchBusy(false);
    }
  }, [selected, batchBusy, exitSelectMode]);

  const handleBatchHide = useCallback(async () => {
    if (selected.size === 0 || batchBusy) return;
    const hide = !isPrivate;
    setBatchBusy(true);
    try {
      await Promise.all([...selected].map((id) => hideImage(id, hide)));
      for (const id of selected) {
        window.dispatchEvent(new CustomEvent("gallery-image-hidden", { detail: { id, hidden: hide } }));
      }
      exitSelectMode();
    } catch (err) {
      console.error("[Gallery] Batch hide failed:", err);
    } finally {
      setBatchBusy(false);
    }
  }, [selected, batchBusy, isPrivate, exitSelectMode]);

  return (
    <div className="flex flex-col h-full px-4 pt-4 pb-2">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-medium text-text font-display animate-fadeUpBlur">
            {selectMode ? `${selected.size} seleccionada${selected.size !== 1 ? "s" : ""}` : "Galería"}
          </h1>
          {images.length > 0 && (
            <button
              onClick={selectMode ? exitSelectMode : () => setSelectMode(true)}
              className="text-xs font-medium text-noa hover:text-noa/80 transition-colors px-3 py-1.5 rounded-lg hover:bg-white/[0.04]"
            >
              {selectMode ? "Cancelar" : "Seleccionar"}
            </button>
          )}
        </div>

        {/* Tabs — solo mostrar si hay PIN y está desbloqueado */}
        {isPrivateUnlocked && !selectMode && (
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
            <MasonryGrid
              images={images}
              columnCount={columnCount}
              selectMode={selectMode}
              selected={selected}
              isPrivate={isPrivate}
              onToggleSelect={toggleSelect}
              onImageClick={onImageClick}
              paddingBottom={selectMode && selected.size > 0}
            />

            {/* Batch action bar */}
            {selectMode && selected.size > 0 && (
              <div className="fixed bottom-16 sm:bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-white/15 shadow-2xl"
                style={{ backgroundColor: "rgba(15, 15, 18, 0.92)", backdropFilter: "blur(16px)" }}
              >
                <button
                  onClick={handleBatchHide}
                  disabled={batchBusy}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium text-white bg-white/[0.08] hover:bg-white/[0.12] transition-colors disabled:opacity-50"
                >
                  {isPrivate ? <ArchiveRestore className="size-3.5" /> : <Archive className="size-3.5" />}
                  {isPrivate ? "Restaurar" : "Archivar"}
                </button>
                <button
                  onClick={handleBatchDelete}
                  disabled={batchBusy}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium text-red-300 bg-red-500/10 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="size-3.5" />
                  Eliminar
                </button>
                {batchBusy && <Loader2 className="size-4 animate-spin text-text-muted" />}
              </div>
            )}

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

/* ─── Masonry Grid (Pinterest-style, no reflow) ─── */

function MasonryGrid({
  images,
  columnCount,
  selectMode,
  selected,
  isPrivate,
  onToggleSelect,
  onImageClick,
  paddingBottom,
}: {
  images: GalleryImage[];
  columnCount: number;
  selectMode: boolean;
  selected: Set<string>;
  isPrivate: boolean;
  onToggleSelect: (id: string) => void;
  onImageClick: (src: string, imageId?: string, isHidden?: boolean) => void;
  paddingBottom: boolean;
}) {
  // Distribuir imágenes en columnas round-robin (mantiene orden estable)
  const columns = useMemo(() => {
    const cols: GalleryImage[][] = Array.from({ length: columnCount }, () => []);
    images.forEach((img, i) => {
      cols[i % columnCount].push(img);
    });
    return cols;
  }, [images, columnCount]);

  return (
    <div className={`flex gap-1.5 ${paddingBottom ? "pb-20" : "pb-4"}`}>
      {columns.map((col, colIdx) => (
        <div key={colIdx} className="flex-1 flex flex-col gap-1.5 min-w-0">
          {col.map((img) => {
            const isSelected = selected.has(img.id);
            return (
              <div
                key={img.id}
                onClick={() => {
                  if (selectMode) onToggleSelect(img.id);
                  else onImageClick(img.image, img.id, img.is_hidden);
                }}
                className={`relative rounded-xl overflow-hidden cursor-pointer group bg-bg-surface border transition-all ${
                  isSelected
                    ? "border-noa ring-2 ring-noa/40 scale-[0.97]"
                    : "border-border"
                }`}
              >
                <img
                  src={getCfTransformUrl(img.image, "thumb")}
                  alt={img.content || "Imagen generada"}
                  className={`w-full h-auto object-cover block transition-opacity ${selectMode && !isSelected ? "opacity-70" : ""}`}
                  loading="lazy"
                  decoding="async"
                />

                {selectMode && (
                  <div className="absolute top-1.5 right-1.5">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                      isSelected
                        ? "bg-noa text-[#0a0a0c]"
                        : "bg-black/50 backdrop-blur-sm border border-white/30"
                    }`}>
                      {isSelected && <CheckCircle2 className="size-4" />}
                    </div>
                  </div>
                )}

                {isPrivate && !selectMode && (
                  <div className="absolute top-2 left-2">
                    <div className="w-6 h-6 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
                      <EyeOff className="size-3 text-white/70" />
                    </div>
                  </div>
                )}

                {!selectMode && img.engine && (
                  <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm text-[7px] font-mono text-white/70 pointer-events-none">
                    {img.engine.replace("studioflux-", "").replace("sdxl-", "")}
                  </div>
                )}

                {!selectMode && img.content && (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-3 pt-8 pointer-events-none">
                    <p className="text-[11px] text-white/85 line-clamp-2">
                      {img.content}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
