import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { EyeOff, Eye, Image as ImageIcon, Lock, X } from "lucide-react";
import { listImages, fetchRatingsMap, hideImage } from "@/lib/api";
import { Skeleton } from "@/components/ui/Skeleton";
import { Pill } from "@/components/ui/Pill";
import { usePrivateMode } from "@/hooks/usePrivateMode";
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
    [view],
  );

  // Reset + reload cuando cambia view
  useEffect(() => {
    setItems([]);
    setCursor(null);
    setDone(false);
    setLoading(true);
    loadPage(undefined, view);
  }, [view, loadPage]);

  useEffect(() => {
    fetchRatingsMap()
      .then(setRatings)
      .catch(() => {});
  }, []);

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
            <div className="flex gap-1.5 bg-[var(--color-bg-elevated)] p-1 rounded-full border border-white/[0.06]">
              <ViewTab active={view === "all"} onClick={() => setView("all")} label="Todas" />
              <ViewTab
                active={view === "private"}
                onClick={() => setView("private")}
                label="Privadas"
                icon={<EyeOff className="size-3.5" />}
              />
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-3 md:px-6 pb-6">
        {items.length === 0 && loading ? (
          <SkeletonGrid />
        ) : items.length === 0 ? (
          <EmptyState view={view} hasPin={hasPin} />
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

      {modalImage && (
        <ImageViewer
          image={modalImage}
          onClose={() => setModalImage(null)}
          canMoveToPrivate={hasPin}
          onToggleHidden={handleToggleHidden}
        />
      )}
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
        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] transition",
        active
          ? "bg-white/[0.10] text-white"
          : "text-white/55 hover:text-white hover:bg-white/[0.04]",
      )}
    >
      {icon}
      {label}
    </button>
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
  const url = image.url || "";
  const thumbUrl =
    url.includes("/storage/v1/object/public/")
      ? url.replace(
          "/storage/v1/object/public/",
          "/storage/v1/render/image/public/?width=600&quality=85&resize=contain&path=",
        )
      : url;

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
}: {
  image: ChatImage;
  onClose: () => void;
  canMoveToPrivate: boolean;
  onToggleHidden: (img: ChatImage) => void;
}) {
  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const showToggle = canMoveToPrivate || image.hidden;
  const isHidden = !!image.hidden;

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

      {showToggle && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleHidden(image);
          }}
          className="absolute top-4 left-4 flex items-center gap-2 h-10 px-3.5 rounded-full bg-white/[0.08] hover:bg-white/[0.16] transition text-[13px] text-white"
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
        <Pill tone="neutral" size="sm" className="absolute bottom-6 left-4">
          <Lock className="size-3 mr-1" /> Privada
        </Pill>
      )}

      <img
        src={image.url}
        alt={image.prompt || ""}
        className="max-w-full max-h-full object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
      />
    </motion.div>
  );
}
