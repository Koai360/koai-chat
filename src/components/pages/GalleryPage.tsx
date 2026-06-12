import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, EyeOff, Eye, Image as ImageIcon, Lock, Trash2, X } from "lucide-react";
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
              onSelect={setModalImage}
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
  onSelect,
}: {
  items: ChatImage[];
  ratings: Record<string, number>;
  onSelect: (img: ChatImage) => void;
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
              onClick={() => onSelect(img)}
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
  onClick,
}: {
  image: ChatImage;
  rating?: number;
  onClick: () => void;
}) {
  const url = image.url || "";
  // S158-b: helper compartido (MessageBubble/ImageViewer usan el mismo)
  const thumbUrl = cfImageVariant(url, 800);

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
      onClick={onClick}
      className={cn(
        "group relative w-full mb-2 md:mb-3 break-inside-avoid rounded-xl overflow-hidden",
        "bg-[var(--color-bg-elevated)] border border-white/[0.06]",
        "hover:border-white/[0.16] transition-colors",
        "block text-left",
      )}
      // Si aún no sabemos el aspect (no vino del backend ni probe completó),
      // arrancar con cuadrado como placeholder. Cuando probe complete, transitions.
      style={{ aspectRatio: aspectRatio ?? "1 / 1" }}
    >
      {/* S161: layoutId compartido con el viewer → el tile se EXPANDE
          físicamente al abrir (shared element transition) */}
      <motion.img
        layoutId={`gimg-${image.id}`}
        src={thumbUrl}
        alt={image.prompt || ""}
        loading="lazy"
        decoding="async"
        className="absolute inset-0 w-full h-full object-cover block"
      />
      {image.hidden && (
        <div className="absolute top-1.5 left-1.5 bg-black/70 backdrop-blur-sm rounded-full size-6 flex items-center justify-center">
          <EyeOff className="size-3 text-white" />
        </div>
      )}
      {rating && rating > 0 && (
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
        className="absolute right-4 size-11 rounded-full bg-black/65 hover:bg-black/85 backdrop-blur-xl border border-white/15 shadow-[0_4px_20px_rgba(0,0,0,0.55)] flex items-center justify-center transition-all active:scale-95 top-[calc(env(safe-area-inset-top,0px)+1rem)]"
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
          className="absolute left-4 flex items-center gap-2 h-11 px-4 rounded-full bg-black/65 hover:bg-black/85 backdrop-blur-xl border border-white/15 shadow-[0_4px_20px_rgba(0,0,0,0.55)] transition-all active:scale-95 text-[13px] font-medium text-white top-[calc(env(safe-area-inset-top,0px)+1rem)]"
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
        <div className="absolute left-4 bottom-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] flex items-center gap-1.5 h-8 px-3 rounded-full bg-black/65 backdrop-blur-xl border border-white/15 shadow-[0_4px_20px_rgba(0,0,0,0.55)] text-[12px] font-medium text-white">
          <Lock className="size-3" /> Privada
        </div>
      )}

      {/* S163: descargar — botón centro-abajo (share sheet iOS / a[download]) */}
      <button
        onClick={handleDownload}
        disabled={saving}
        className="absolute left-1/2 -translate-x-1/2 bottom-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] flex items-center gap-2 h-11 px-5 rounded-full bg-black/65 hover:bg-black/85 backdrop-blur-xl border border-white/15 shadow-[0_4px_20px_rgba(0,0,0,0.55)] transition-all active:scale-95 text-[13px] font-medium text-white disabled:opacity-60"
      >
        <Download className="size-4" />
        <span>{saving ? "Guardando…" : "Descargar"}</span>
      </button>

      {/* S161: eliminar imagen — icono abajo a la derecha, confirmación inline */}
      <div
        className="absolute right-4 bottom-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]"
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
