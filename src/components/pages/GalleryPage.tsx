import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Download, EyeOff, Eye, Image as ImageIcon, Lock, Trash2, X } from "lucide-react";
import { listImages, fetchRatingsMap, hideImage, deleteImage } from "@/lib/api";
import { downloadOrShareImage } from "@/lib/downloadImage";
import { cfImageVariant } from "@/lib/imageTransform";
import { Skeleton } from "@/components/ui/Skeleton";
import { usePrivateMode } from "@/hooks/usePrivateMode";
import { useModalBack } from "@/hooks/useModalBack";
import type { ChatImage } from "@/types/api";
import { cn } from "@/lib/cn";
import { toast } from "sonner";

/**
 * GalleryPage — masonry de imágenes generadas + viewer modal.
 *
 * - Infinite scroll con cursor del backend
 * - 2-4 columnas según viewport
 * - Click → modal full-screen
 * - Tab "Privadas" cuando isUnlocked (galería con hidden=true)
 * - Botón en ImageViewer para mover entre normal/privada
 */
type View = "all" | "private";

export function GalleryPage() {
  const { hasPin, isUnlocked } = usePrivateMode();
  const [view, setView] = useState<View>("all");
  const [items, setItems] = useState<ChatImage[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  // S158-b: errores ya no se disfrazan de empty state — error real + retry
  const [loadError, setLoadError] = useState(false);
  const [pageError, setPageError] = useState(false);
  // S158-b: race guard Todas↔Privadas — respuesta vieja no pisa la vista nueva
  const viewRef = useRef<View>(view);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [modalImage, setModalImage] = useState<ChatImage | null>(null);
  const observerRef = useRef<HTMLDivElement>(null);
  // Brief Noa 07-05: selección múltiple — botón "Seleccionar" o long-press
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmingBulk, setConfirmingBulk] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  // Si la galería privada se bloquea mientras estoy viendo "Privadas", volvé a "Todas"
  useEffect(() => {
    if (view === "private" && !isUnlocked) setView("all");
  }, [view, isUnlocked]);

  const loadPage = useCallback(
    async (before?: string, currentView: View = view) => {
      try {
        const { items: newItems, next_cursor } = await listImages({
          limit: 24,
          before,
          hidden: currentView === "private",
        });
        // S158-b: si el usuario ya cambió de pestaña, descartar esta respuesta
        if (viewRef.current !== currentView) return;
        setItems((prev) => (before ? [...prev, ...newItems] : newItems));
        setCursor(next_cursor || null);
        setLoadError(false);
        setPageError(false);
        // review Codex: re-abrir el infinite scroll si vuelve a haber cursor
        // (ej. noa:image-generated refresca cuando done ya era true)
        setDone(!next_cursor);
      } catch (err) {
        console.warn("[GalleryPage] load failed", err);
        if (viewRef.current !== currentView) return;
        // S158-b: carga inicial fallida → estado de error con Reintentar (antes
        // se mostraba "Sin imágenes aún" — parecía pérdida de datos). Fallo de
        // paginación → botón "Cargar más" manual, NO done=true.
        if (before) setPageError(true);
        else setLoadError(true);
      } finally {
        if (viewRef.current === currentView) setLoading(false);
      }
    },
    [view],
  );

  // Reset + reload cuando cambia view
  useEffect(() => {
    viewRef.current = view;
    setItems([]);
    setCursor(null);
    setDone(false);
    setLoadError(false);
    setPageError(false);
    setLoading(true);
    setSelectMode(false);
    setSelected(new Set());
    setConfirmingBulk(false);
    loadPage(undefined, view);
  }, [view, loadPage]);

  useEffect(() => {
    fetchRatingsMap()
      .then(setRatings)
      .catch(() => {});
  }, []);

  // Auto-refresh cuando se genera imagen nueva en el chat (S136).
  // El backend persiste a chat_messages.image con ~1-3s de delay (R2 upload + INSERT).
  // Esperamos 2.5s antes de re-fetch para que ya esté disponible en /api/chat/images.
  useEffect(() => {
    const handler = () => {
      // Solo refresh si estoy viendo la vista "all" (las nuevas nunca son privadas)
      if (view !== "all") return;
      setTimeout(() => {
        loadPage(undefined, "all");
      }, 2500);
    };
    window.addEventListener("noa:image-generated", handler);
    return () => window.removeEventListener("noa:image-generated", handler);
  }, [view, loadPage]);

  // Infinite scroll
  useEffect(() => {
    if (!observerRef.current || done || loading) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && cursor) {
          setLoading(true);
          loadPage(cursor, view);
        }
      },
      { threshold: 0.1 },
    );
    obs.observe(observerRef.current);
    return () => obs.disconnect();
  }, [cursor, done, loading, loadPage, view]);

  const handleToggleHidden = useCallback(
    async (image: ChatImage) => {
      const nextHidden = !image.hidden;
      try {
        await hideImage(image.id, nextHidden);
        toast.success(nextHidden ? "Movida a galería privada" : "Movida a galería normal");
        setItems((prev) => prev.filter((i) => i.id !== image.id));
        setModalImage(null);
      } catch (err) {
        toast.error("No se pudo mover la imagen");
        console.warn("[GalleryPage] hide failed", err);
      }
    },
    [],
  );

  // S161: borrar imagen desde el viewer (icono → confirmar → delete)
  const handleDelete = useCallback(async (image: ChatImage) => {
    try {
      await deleteImage(image.id);
      toast.success("Imagen eliminada");
      setItems((prev) => prev.filter((i) => i.id !== image.id));
      setModalImage(null);
    } catch (err) {
      toast.error("No se pudo eliminar la imagen");
      console.warn("[GalleryPage] delete failed", err);
      throw err;
    }
  }, []);

  // ── Selección múltiple (brief Noa 07-05) ──────────────────────────────
  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelected(new Set());
    setConfirmingBulk(false);
  }, []);

  const toggleSelected = useCallback((img: ChatImage) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(img.id)) next.delete(img.id);
      else next.add(img.id);
      return next;
    });
    setConfirmingBulk(false);
  }, []);

  // Long-press sobre un tile activa el modo y selecciona ese tile
  const enterSelectWith = useCallback((img: ChatImage) => {
    setSelectMode(true);
    setSelected(new Set([img.id]));
  }, []);

  // Escape sale del modo selección (desktop)
  useEffect(() => {
    if (!selectMode) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") exitSelectMode();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectMode, exitSelectMode]);

  // Bulk sobre los seleccionados: allSettled → los que fallan quedan en la
  // grilla y se reporta el conteo (nunca "todo OK" si algo falló).
  const runBulk = useCallback(
    async (op: (id: string) => Promise<void>, okMsg: (n: number) => string, failMsg: (n: number) => string) => {
      if (bulkBusy || selected.size === 0) return;
      setBulkBusy(true);
      const ids = Array.from(selected);
      const results = await Promise.allSettled(ids.map((id) => op(id)));
      const okIds = new Set(ids.filter((_, i) => results[i].status === "fulfilled"));
      const failedCount = ids.length - okIds.size;
      if (okIds.size > 0) setItems((prev) => prev.filter((i) => !okIds.has(i.id)));
      if (okIds.size > 0) toast.success(okMsg(okIds.size));
      if (failedCount > 0) toast.error(failMsg(failedCount));
      setBulkBusy(false);
      exitSelectMode();
    },
    [bulkBusy, selected, exitSelectMode],
  );

  const handleBulkDelete = () =>
    runBulk(
      (id) => deleteImage(id),
      (n) => (n === 1 ? "1 imagen eliminada" : `${n} imágenes eliminadas`),
      (n) => (n === 1 ? "1 imagen no se pudo eliminar" : `${n} imágenes no se pudieron eliminar`),
    );

  const handleBulkHide = () => {
    const nextHidden = view === "all";
    return runBulk(
      (id) => hideImage(id, nextHidden),
      (n) =>
        nextHidden
          ? n === 1 ? "1 imagen movida a privada" : `${n} imágenes movidas a privada`
          : n === 1 ? "1 imagen movida a galería normal" : `${n} imágenes movidas a galería normal`,
      (n) => (n === 1 ? "1 imagen no se pudo mover" : `${n} imágenes no se pudieron mover`),
    );
  };

  const showPrivateTab = hasPin && isUnlocked;

  return (
    <div className="h-full flex flex-col">
      <header className="px-6 pt-6 pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="display text-[24px] md:text-[28px] font-semibold text-white mb-1">
              Galería
            </h1>
            <p className="text-sm text-white/45">
              {items.length > 0
                ? `${items.length} ${view === "private" ? "privadas" : "imágenes"}`
                : view === "private"
                  ? "Imágenes privadas"
                  : "Imágenes generadas"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {items.length > 0 && (
              <button
                onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
                className={cn(
                  "h-11 px-4 rounded-full text-[14px] font-medium transition-all border",
                  selectMode
                    ? "bg-white text-black border-white"
                    : "bg-[var(--color-bg-elevated)] text-white/75 hover:text-white border-white/[0.08]",
                )}
              >
                {selectMode ? "Listo" : "Seleccionar"}
              </button>
            )}

            {showPrivateTab && (
              <div className="flex gap-1 bg-[var(--color-bg-elevated)] p-1 rounded-full border border-white/[0.08] shadow-[0_2px_12px_rgba(0,0,0,0.30)]">
                <ViewTab active={view === "all"} onClick={() => setView("all")} label="Todas" />
                <ViewTab
                  active={view === "private"}
                  onClick={() => setView("private")}
                  label="Privadas"
                  icon={<EyeOff className="size-4" />}
                />
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-3 md:px-6 pb-6">
        {items.length === 0 && loading ? (
          <SkeletonMasonry />
        ) : items.length === 0 && loadError ? (
          <ErrorState onRetry={() => { setLoadError(false); setLoading(true); loadPage(undefined, view); }} />
        ) : items.length === 0 ? (
          <EmptyState view={view} hasPin={hasPin} />
        ) : (
          <>
            {/* S158-b: masonry con columnas JS (shortest-column) en vez de CSS
                multicol — multicol REBALANCEA y reordena los tiles existentes
                en cada página del infinite scroll. La distribución por prefijo
                es determinística: el append nunca mueve lo ya pintado. */}
            <MasonryColumns
              items={items}
              ratings={ratings}
              selectMode={selectMode}
              selectedIds={selected}
              onTap={(img) => (selectMode ? toggleSelected(img) : setModalImage(img))}
              onLongPress={enterSelectWith}
            />
            {pageError ? (
              <div className="h-20 flex items-center justify-center">
                <button
                  onClick={() => { setPageError(false); setLoading(true); loadPage(cursor ?? undefined, view); }}
                  className="px-4 py-2 rounded-full bg-white/[0.08] hover:bg-white/[0.14] text-white/85 text-[13px] transition-colors"
                >
                  Cargar más
                </button>
              </div>
            ) : !done && (
              <div ref={observerRef} className="h-20 flex items-center justify-center">
                {loading && <Skeleton width={100} height={12} className="rounded-full" />}
              </div>
            )}
          </>
        )}
      </div>

      {/* Barra flotante de acciones bulk (brief Noa 07-05) */}
      <AnimatePresence>
        {selectMode && (
          <motion.div
            key="selection-bar"
            initial={{ y: 72, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 72, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="fixed left-1/2 -translate-x-1/2 z-40 bottom-[calc(var(--sab)+1rem)] max-w-[calc(100vw-1.5rem)]"
          >
            {confirmingBulk ? (
              <div className="flex items-center gap-2 h-12 pl-4 pr-1.5 rounded-full bg-black/80 backdrop-blur-xl border border-red-500/40 shadow-[0_4px_20px_rgba(0,0,0,0.55)]">
                <span className="text-[13px] font-medium text-white whitespace-nowrap">
                  ¿Eliminar {selected.size === 1 ? "1 imagen" : `${selected.size} imágenes`}?
                </span>
                <button
                  onClick={() => setConfirmingBulk(false)}
                  disabled={bulkBusy}
                  className="h-9 px-3 rounded-full text-[13px] font-medium text-white/75 hover:text-white hover:bg-white/[0.08] transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={bulkBusy}
                  className="h-9 px-3.5 rounded-full bg-red-500/90 hover:bg-red-500 text-[13px] font-semibold text-white transition-colors disabled:opacity-60"
                >
                  {bulkBusy ? "Eliminando…" : "Eliminar"}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 h-12 pl-4 pr-1.5 rounded-full bg-black/80 backdrop-blur-xl border border-white/15 shadow-[0_4px_20px_rgba(0,0,0,0.55)]">
                <span className="text-[13px] font-medium text-white whitespace-nowrap tabular-nums">
                  {selected.size === 0
                    ? "Tocá para seleccionar"
                    : selected.size === 1
                      ? "1 seleccionada"
                      : `${selected.size} seleccionadas`}
                </span>
                {(view === "private" || hasPin) && (
                  <button
                    onClick={handleBulkHide}
                    disabled={bulkBusy || selected.size === 0}
                    className="flex items-center gap-1.5 h-9 px-3 rounded-full text-[13px] font-medium text-white/85 hover:text-white hover:bg-white/[0.10] transition-colors disabled:opacity-40"
                  >
                    {view === "private" ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                    <span className="hidden sm:inline">
                      {view === "private" ? "A normal" : "A privada"}
                    </span>
                  </button>
                )}
                <button
                  onClick={() => setConfirmingBulk(true)}
                  disabled={bulkBusy || selected.size === 0}
                  className="flex items-center gap-1.5 h-9 px-3 rounded-full text-[13px] font-medium text-red-400 hover:text-red-300 hover:bg-red-500/[0.12] transition-colors disabled:opacity-40"
                >
                  <Trash2 className="size-4" />
                  <span className="hidden sm:inline">Eliminar</span>
                </button>
                <button
                  onClick={exitSelectMode}
                  disabled={bulkBusy}
                  className="size-9 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/[0.10] transition-colors disabled:opacity-40"
                  aria-label="Salir de selección"
                >
                  <X className="size-4" strokeWidth={2.5} />
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* S158-b: AnimatePresence — el exit fade del viewer estaba muerto
          (desmontaba de golpe pese a tener exit definido) */}
      <AnimatePresence>
        {modalImage && (
          <ImageViewer
            key="image-viewer"
            image={modalImage}
            onClose={() => setModalImage(null)}
            canMoveToPrivate={hasPin}
            onToggleHidden={handleToggleHidden}
            onDelete={handleDelete}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ViewTab({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 h-9 px-4 rounded-full text-[14px] font-medium transition-all",
        active
          ? "bg-white text-black"
          : "text-white/60 hover:text-white hover:bg-white/[0.04]",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

/** S158-b: distribución shortest-column estable — append nunca reordena. */
function MasonryColumns({
  items,
  ratings,
  selectMode,
  selectedIds,
  onTap,
  onLongPress,
}: {
  items: ChatImage[];
  ratings: Record<string, number>;
  selectMode: boolean;
  selectedIds: Set<string>;
  onTap: (img: ChatImage) => void;
  onLongPress: (img: ChatImage) => void;
}) {
  const cols = useColumnCount();
  const columns: ChatImage[][] = Array.from({ length: cols }, () => []);
  const heights = new Array(cols).fill(0);
  for (const img of items) {
    // Altura estimada ∝ h/w (las legacy sin dims asumen 1:1, mismo supuesto
    // que el placeholder del tile)
    const ratio =
      img.width && img.height && img.width > 0 ? img.height / img.width : 1;
    let target = 0;
    for (let c = 1; c < cols; c++) if (heights[c] < heights[target]) target = c;
    columns[target].push(img);
    heights[target] += ratio;
  }
  return (
    <div className="flex gap-2 md:gap-3 items-start">
      {columns.map((col, ci) => (
        <div key={ci} className="flex-1 min-w-0">
          {col.map((img) => (
            <GalleryTile
              key={img.id}
              image={img}
              rating={ratings[img.id]}
              selectMode={selectMode}
              selected={selectedIds.has(img.id)}
              onTap={() => onTap(img)}
              onLongPress={() => onLongPress(img)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function useColumnCount(): number {
  const get = () => {
    if (typeof window === "undefined") return 2;
    if (window.matchMedia("(min-width: 1280px)").matches) return 4;
    if (window.matchMedia("(min-width: 768px)").matches) return 3;
    return 2;
  };
  const [cols, setCols] = useState(get);
  useEffect(() => {
    const mq3 = window.matchMedia("(min-width: 768px)");
    const mq4 = window.matchMedia("(min-width: 1280px)");
    const update = () => setCols(get());
    mq3.addEventListener("change", update);
    mq4.addEventListener("change", update);
    return () => {
      mq3.removeEventListener("change", update);
      mq4.removeEventListener("change", update);
    };
  }, []);
  return cols;
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <ImageIcon className="size-12 text-white/20 mb-3" />
      <h2 className="text-lg text-white/85 mb-1">No se pudo cargar la galería</h2>
      <p className="text-sm text-white/45 max-w-sm mb-4">
        Revisá tu conexión e intentá de nuevo.
      </p>
      <button
        onClick={onRetry}
        className="px-4 py-2 rounded-full bg-white/[0.08] hover:bg-white/[0.14] text-white/90 text-[14px] transition-colors"
      >
        Reintentar
      </button>
    </div>
  );
}

function GalleryTile({
  image,
  rating,
  selectMode,
  selected,
  onTap,
  onLongPress,
}: {
  image: ChatImage;
  rating?: number;
  selectMode: boolean;
  selected: boolean;
  onTap: () => void;
  onLongPress: () => void;
}) {
  const url = image.url || "";
  // S158-b: helper compartido (MessageBubble/ImageViewer usan el mismo)
  const thumbUrl = cfImageVariant(url, 800);

  // Long-press (~450ms, tolerancia 10px de movimiento) → entra a selección.
  // pointer events cubren touch + mouse; el flag suprime el click fantasma
  // que algunos browsers disparan al soltar después del long-press.
  const pressTimer = useRef<number | null>(null);
  const pressOrigin = useRef<{ x: number; y: number } | null>(null);
  const longPressFired = useRef(false);

  const clearPress = () => {
    if (pressTimer.current !== null) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    pressOrigin.current = null;
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (selectMode) return; // ya en selección: tap simple alcanza
    pressOrigin.current = { x: e.clientX, y: e.clientY };
    longPressFired.current = false;
    pressTimer.current = window.setTimeout(() => {
      longPressFired.current = true;
      clearPress();
      onLongPress();
    }, 450);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!pressOrigin.current) return;
    const dx = e.clientX - pressOrigin.current.x;
    const dy = e.clientY - pressOrigin.current.y;
    if (dx * dx + dy * dy > 100) clearPress(); // scroll/drag: no es long-press
  };

  const handleClick = () => {
    if (longPressFired.current) {
      longPressFired.current = false;
      return;
    }
    onTap();
  };

  // S136 — Pinterest masonry sin layout shift:
  // 1) Imágenes nuevas: backend persiste width/height → usar aspect-ratio = w/h
  // 2) Imágenes legacy (sin dims): probe con new Image() onLoad → cache local
  // 3) Fallback antes de detectar: aspect-square placeholder (~95% son 1:1)
  const initialAspect =
    image.width && image.height && image.width > 0 && image.height > 0
      ? `${image.width} / ${image.height}`
      : null;
  const [aspectRatio, setAspectRatio] = useState<string | null>(initialAspect);

  // Si no tenemos dims del backend, probe con un Image() — set local state al
  // cargar. Solo corre para histórico; nuevas no entran a este path.
  useEffect(() => {
    if (aspectRatio) return; // ya conocido
    const probe = new Image();
    probe.onload = () => {
      if (probe.naturalWidth > 0 && probe.naturalHeight > 0) {
        setAspectRatio(`${probe.naturalWidth} / ${probe.naturalHeight}`);
      }
    };
    probe.src = thumbUrl;
    return () => {
      probe.onload = null;
    };
  }, [thumbUrl, aspectRatio]);

  return (
    <button
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={clearPress}
      onPointerCancel={clearPress}
      onPointerLeave={clearPress}
      onContextMenu={(e) => {
        // long-press en iOS/desktop no debe abrir menú contextual del browser
        if (selectMode || pressTimer.current !== null) e.preventDefault();
      }}
      aria-pressed={selectMode ? selected : undefined}
      className={cn(
        "group relative w-full mb-2 md:mb-3 break-inside-avoid rounded-xl overflow-hidden",
        "bg-[var(--color-bg-elevated)] border transition-colors",
        "block text-left select-none",
        selected
          ? "border-white/90 ring-2 ring-white/80"
          : "border-white/[0.06] hover:border-white/[0.16]",
      )}
      // Si aún no sabemos el aspect (no vino del backend ni probe completó),
      // arrancar con cuadrado como placeholder. Cuando probe complete, transitions.
      style={{ aspectRatio: aspectRatio ?? "1 / 1", WebkitTouchCallout: "none" }}
    >
      {/* S161: layoutId compartido con el viewer → el tile se EXPANDE
          físicamente al abrir (shared element transition) */}
      <motion.img
        layoutId={`gimg-${image.id}`}
        src={thumbUrl}
        alt={image.prompt || ""}
        loading="lazy"
        decoding="async"
        draggable={false}
        className={cn(
          "absolute inset-0 w-full h-full object-cover block transition-[transform,opacity] duration-150",
          selected && "scale-[0.94] opacity-80 rounded-lg",
        )}
      />
      {/* Indicador de selección (brief Noa 07-05) */}
      {selectMode && (
        <div
          className={cn(
            "absolute top-2 right-2 size-6 rounded-full flex items-center justify-center border-2 transition-colors",
            selected
              ? "bg-white border-white"
              : "bg-black/40 border-white/70 backdrop-blur-sm",
          )}
        >
          {selected && <Check className="size-4 text-black" strokeWidth={3} />}
        </div>
      )}
      {image.hidden && (
        <div className="absolute top-1.5 left-1.5 bg-black/70 backdrop-blur-sm rounded-full size-6 flex items-center justify-center">
          <EyeOff className="size-3 text-white" />
        </div>
      )}
      {rating && rating > 0 && !selectMode && (
        <div className="absolute top-1.5 right-1.5 bg-black/70 backdrop-blur-sm rounded-full px-1.5 py-0.5 text-[10px] text-white mono">
          ★ {rating}
        </div>
      )}
    </button>
  );
}

function SkeletonMasonry() {
  // Skeletons cuadrados — matchea el aspect-square real de los tiles
  // (evita layout shift al transicionar skeleton → contenido real)
  return (
    <div className="columns-2 md:columns-3 xl:columns-4 gap-2 md:gap-3">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="mb-2 md:mb-3 break-inside-avoid aspect-square">
          <Skeleton variant="rect" className="rounded-xl w-full h-full" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ view, hasPin }: { view: View; hasPin: boolean }) {
  if (view === "private") {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Lock className="size-12 text-white/20 mb-3" />
        <h2 className="text-lg text-white/85 mb-1">Galería privada vacía</h2>
        <p className="text-sm text-white/45 max-w-sm">
          Tocá el botón de ocultar en cualquier imagen de la galería normal para moverla acá.
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <ImageIcon className="size-12 text-white/20 mb-3" />
      <h2 className="text-lg text-white/85 mb-1">Sin imágenes aún</h2>
      <p className="text-sm text-white/45 max-w-sm">
        Pedile a Noa que genere algo: "dibuja un dashboard premium", "una mascota origami", etc.
      </p>
      {hasPin && (
        <p className="text-xs text-white/35 mt-3">
          Configurá Privacidad en Configuración para ocultar imágenes detrás de PIN.
        </p>
      )}
    </div>
  );
}

function ImageViewer({
  image,
  onClose,
  canMoveToPrivate,
  onToggleHidden,
  onDelete,
}: {
  image: ChatImage;
  onClose: () => void;
  canMoveToPrivate: boolean;
  onToggleHidden: (img: ChatImage) => void;
  onDelete: (img: ChatImage) => Promise<void>;
}) {
  // S161: flujo eliminar — icono 🗑 → barra de confirmación → delete
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // S163: descargar/compartir (share sheet iOS → "Guardar imagen")
  const [saving, setSaving] = useState(false);
  // S164: gesto "atrás" de iOS cierra el viewer en vez de navegar la app
  const close = useModalBack(onClose);

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (saving) return;
    setSaving(true);
    try {
      const result = await downloadOrShareImage(image.url);
      if (result === "downloaded") toast.success("Imagen descargada");
      if (result === "opened")
        toast.info("Abrí la imagen — mantenela presionada para guardarla");
    } catch {
      toast.error("No se pudo descargar — intentá de nuevo");
    } finally {
      setSaving(false);
    }
  };

  // Escape to close + scroll-lock del documento (S164)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", handler);
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.documentElement.style.overflow = prevOverflow;
    };
  }, [close]);

  // No hace falta reset por cambio de imagen: el viewer se desmonta al cerrar
  // (AnimatePresence) y no hay navegación entre imágenes dentro del modal.

  const handleConfirmDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await onDelete(image);
      // onDelete cierra el modal en éxito; en error tira y reseteamos abajo
    } catch {
      setDeleting(false);
      setConfirmingDelete(false);
    }
  };

  const showToggle = canMoveToPrivate || image.hidden;
  const isHidden = !!image.hidden;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex items-center justify-center p-4"
      style={{ touchAction: "none", overscrollBehavior: "contain" }}
      onClick={close}
    >
      {/* Botones flotantes — fondo oscuro garantizado + border + shadow para
          legibilidad sobre cualquier imagen (clara u oscura). Pattern iOS clásico. */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          close();
        }}
        className="absolute right-4 size-11 rounded-full bg-black/65 hover:bg-black/85 backdrop-blur-xl border border-white/15 shadow-[0_4px_20px_rgba(0,0,0,0.55)] flex items-center justify-center transition-all active:scale-95 top-[calc(var(--sat)+1rem)]"
        aria-label="Cerrar"
      >
        <X className="size-5 text-white" strokeWidth={2.5} />
      </button>

      {showToggle && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleHidden(image);
          }}
          className="absolute left-4 flex items-center gap-2 h-11 px-4 rounded-full bg-black/65 hover:bg-black/85 backdrop-blur-xl border border-white/15 shadow-[0_4px_20px_rgba(0,0,0,0.55)] transition-all active:scale-95 text-[13px] font-medium text-white top-[calc(var(--sat)+1rem)]"
        >
          {isHidden ? (
            <>
              <Eye className="size-4" />
              <span>Mover a galería normal</span>
            </>
          ) : (
            <>
              <EyeOff className="size-4" />
              <span>Mover a privada</span>
            </>
          )}
        </button>
      )}

      {isHidden && (
        <div className="absolute left-4 bottom-[calc(var(--sab)+1.5rem)] flex items-center gap-1.5 h-8 px-3 rounded-full bg-black/65 backdrop-blur-xl border border-white/15 shadow-[0_4px_20px_rgba(0,0,0,0.55)] text-[12px] font-medium text-white">
          <Lock className="size-3" /> Privada
        </div>
      )}

      {/* S163: descargar — botón centro-abajo (share sheet iOS / a[download]) */}
      <button
        onClick={handleDownload}
        disabled={saving}
        className="absolute left-1/2 -translate-x-1/2 bottom-[calc(var(--sab)+1.5rem)] flex items-center gap-2 h-11 px-5 rounded-full bg-black/65 hover:bg-black/85 backdrop-blur-xl border border-white/15 shadow-[0_4px_20px_rgba(0,0,0,0.55)] transition-all active:scale-95 text-[13px] font-medium text-white disabled:opacity-60"
      >
        <Download className="size-4" />
        <span>{saving ? "Guardando…" : "Descargar"}</span>
      </button>

      {/* S161: eliminar imagen — icono abajo a la derecha, confirmación inline */}
      <div
        className="absolute right-4 bottom-[calc(var(--sab)+1.5rem)]"
        onClick={(e) => e.stopPropagation()}
      >
        {confirmingDelete ? (
          <div className="flex items-center gap-2 h-11 pl-4 pr-1.5 rounded-full bg-black/80 backdrop-blur-xl border border-red-500/40 shadow-[0_4px_20px_rgba(0,0,0,0.55)]">
            <span className="text-[13px] font-medium text-white whitespace-nowrap">
              ¿Eliminar imagen?
            </span>
            <button
              onClick={() => setConfirmingDelete(false)}
              disabled={deleting}
              className="h-8 px-3 rounded-full text-[13px] font-medium text-white/75 hover:text-white hover:bg-white/[0.08] transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="h-8 px-3.5 rounded-full bg-red-500/90 hover:bg-red-500 text-[13px] font-semibold text-white transition-colors disabled:opacity-60"
            >
              {deleting ? "Eliminando…" : "Eliminar"}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmingDelete(true)}
            className="size-11 rounded-full bg-black/65 hover:bg-red-500/25 backdrop-blur-xl border border-white/15 hover:border-red-500/50 shadow-[0_4px_20px_rgba(0,0,0,0.55)] flex items-center justify-center transition-all active:scale-95"
            aria-label="Eliminar imagen"
          >
            <Trash2 className="size-5 text-white" strokeWidth={2.2} />
          </button>
        )}
      </div>

      {/* S158-b: variante 1600px — el viewer bajaba el PNG original multi-MB.
          S161: layoutId = el tile de la grilla se expande hasta acá (morph). */}
      <motion.img
        layoutId={`gimg-${image.id}`}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        src={cfImageVariant(image.url || "", 1600, 90)}
        alt={image.prompt || ""}
        className="max-w-full max-h-full object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
      />
    </motion.div>
  );
}
