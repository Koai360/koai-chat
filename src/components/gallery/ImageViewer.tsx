import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Download,
  Trash2,
  Loader2,
  Pencil,
  Archive,
  ArchiveRestore,
  MoreHorizontal,
  Star,
  Heart,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/useToast";
import { getCfTransformUrl, getOriginalUrl, triggerDownload } from "@/lib/cfTransform";

interface Props {
  src: string;
  /** Optional: si está presente, muestra acciones de mensaje (delete/hide/rate) */
  imageId?: string;
  /** Callback de eliminar — debe llamar al backend, actualizar lista, y onClose */
  onDelete?: (id: string) => Promise<void>;
  /** Callback de editar — abre ChatInput en modo edit con la URL */
  onEdit?: (imageUrl: string) => void;
  /** Callback de ocultar/mostrar — galería privada (archivar) */
  onHide?: (id: string, hidden: boolean) => Promise<void>;
  /** Si la imagen está oculta actualmente */
  isHidden?: boolean;
  /** Callback de rating — sistema de style preference. 1-5 estrellas, o 0 para quitar. */
  onRate?: (id: string, rating: 0 | 1 | 2 | 3 | 4 | 5) => Promise<void>;
  /** Rating actual de la imagen (1-5 estrellas, 0/undef sin rating) */
  currentRating?: 0 | 1 | 2 | 3 | 4 | 5;
  onClose: () => void;
}

type DownloadVariant = "preview" | "hd" | "4k" | "original";

const DOWNLOAD_OPTIONS: {
  value: DownloadVariant;
  label: string;
  hint: string;
  mark: string;
  color: string;
}[] = [
  { value: "preview",  label: "Preview",  hint: "1200px · ~200KB",  mark: "P", color: "rgba(255,255,255,0.85)" },
  { value: "hd",       label: "HD",       hint: "2048px · ~500KB",  mark: "H", color: "#D4E94B" },
  { value: "4k",       label: "4K",       hint: "4096px · ~2MB",    mark: "K", color: "#00E5FF" },
  { value: "original", label: "Original", hint: "PNG lossless",     mark: "∞", color: "#E5A3F0" },
];

export function ImageViewer({
  src,
  imageId,
  onDelete,
  onEdit,
  onHide,
  isHidden,
  onRate,
  currentRating,
  onClose,
}: Props) {
  const toast = useToast();

  // Action states
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [hiding, setHiding] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false); // desktop dropdown
  const [sheetOpen, setSheetOpen] = useState(false); // mobile bottom sheet

  // Rate state (1-5 estrellas, 0 = sin rating)
  const [rating, setRating] = useState<0 | 1 | 2 | 3 | 4 | 5>(currentRating ?? 0);

  // Double-tap to like
  const lastTapRef = useRef(0);
  const [heartBurst, setHeartBurst] = useState(false);

  // Sync cuando cambia la imagen
  useEffect(() => {
    setRating(currentRating ?? 0);
  }, [src, imageId, currentRating]);

  // Reset state when image changes
  useEffect(() => {
    setDeleting(false);
    setDeleteDialogOpen(false);
    setDownloadOpen(false);
    setMoreOpen(false);
    setSheetOpen(false);
    setHeartBurst(false);
  }, [src, imageId]);

  // Keyboard ESC — close overlays before viewer
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (deleteDialogOpen) setDeleteDialogOpen(false);
      else if (downloadOpen) setDownloadOpen(false);
      else if (moreOpen) setMoreOpen(false);
      else if (sheetOpen) setSheetOpen(false);
      else onClose();
    };
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [deleteDialogOpen, downloadOpen, moreOpen, sheetOpen, onClose]);

  const isR2Url = src.startsWith("https://cdn.koai360.com/") || src.startsWith("https://refnipatiiyddkuxjqaf.supabase.co/");
  const displaySrc = isR2Url ? getCfTransformUrl(src, "fullscreen") : src;

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleDownload = useCallback(
    async (variant: DownloadVariant) => {
      const url = variant === "original" ? getOriginalUrl(src) : getCfTransformUrl(src, variant);
      const ext = variant === "original" ? "png" : "jpg";
      const filename = `koai-${Date.now()}-${variant}.${ext}`;
      setDownloadOpen(false);
      toast.show({
        title: `Descargando ${variant.toUpperCase()}`,
        description: "La descarga empieza en unos segundos",
        duration: 2500,
      });
      try {
        await triggerDownload(url, filename);
        if (navigator.vibrate) navigator.vibrate(10);
      } catch {
        toast.show({
          title: "Error al descargar",
          variant: "danger",
        });
      }
    },
    [src, toast],
  );

  const handleLegacyDownload = useCallback(async () => {
    await triggerDownload(src, `koai-${Date.now()}.png`);
  }, [src]);

  const handleEditClick = useCallback(() => {
    if (!onEdit) return;
    if (navigator.vibrate) navigator.vibrate(8);
    setSheetOpen(false);
    setMoreOpen(false);
    onEdit(getOriginalUrl(src));
    onClose();
  }, [onEdit, src, onClose]);

  const handleHideClick = useCallback(async () => {
    if (!imageId || !onHide) return;
    const wasHidden = !!isHidden;
    setHiding(true);
    setSheetOpen(false);
    setMoreOpen(false);
    try {
      await onHide(imageId, !wasHidden);
      if (navigator.vibrate) navigator.vibrate(10);
      toast.show({
        title: wasHidden ? "Imagen restaurada" : "Imagen archivada",
        description: wasHidden
          ? "Ahora visible en la galería principal"
          : "Movida a galería privada",
        variant: "success",
        action: {
          label: "Deshacer",
          onClick: async () => {
            try {
              await onHide(imageId, wasHidden);
            } catch (err) {
              console.error("[ImageViewer] Undo hide failed:", err);
            }
          },
        },
      });
      onClose();
    } catch (err) {
      console.error("[ImageViewer] Hide failed:", err);
      toast.show({
        title: wasHidden ? "Error al restaurar" : "Error al archivar",
        variant: "danger",
      });
      setHiding(false);
    }
  }, [imageId, isHidden, onHide, onClose, toast]);

  const handleDeleteClick = useCallback(() => {
    if (!imageId || !onDelete) return;
    // Cerrar menús y abrir dialog
    setSheetOpen(false);
    setMoreOpen(false);
    setDeleteDialogOpen(true);
    if (navigator.vibrate) navigator.vibrate(15);
  }, [imageId, onDelete]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!imageId || !onDelete) return;
    setDeleting(true);
    try {
      await onDelete(imageId);
      setDeleteDialogOpen(false);
      if (navigator.vibrate) navigator.vibrate([10, 30, 10]);
      toast.show({
        title: "Imagen eliminada",
        description: "Se eliminó permanentemente",
        variant: "success",
      });
      onClose();
    } catch (err) {
      console.error("[ImageViewer] Delete failed:", err);
      toast.show({
        title: "Error al eliminar",
        variant: "danger",
      });
      setDeleting(false);
    }
  }, [imageId, onDelete, onClose, toast]);

  const handleRate = useCallback(
    async (newRating: 1 | 2 | 3 | 4 | 5) => {
      if (!imageId || !onRate) return;
      // Tap misma estrella = quitar rating
      const target: 0 | 1 | 2 | 3 | 4 | 5 = rating === newRating ? 0 : newRating;
      // Optimistic update — marcar inmediato, API en background
      setRating(target);
      if (navigator.vibrate) navigator.vibrate(target === 0 ? 5 : 10);
      // API call en background (no bloquea UI)
      onRate(imageId, target).catch((err) => {
        console.error("[ImageViewer] Rate failed:", err);
        // Revertir si falla
        setRating(rating);
      });
    },
    [imageId, onRate, rating],
  );

  // Double-tap detection on main image
  const handleImageTap = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!imageId || !onRate) return;
      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        // Double tap → 5 estrellas
        if (rating !== 5) {
          handleRate(5);
        }
        setHeartBurst(true);
        setTimeout(() => setHeartBurst(false), 800);
        lastTapRef.current = 0;
      } else {
        lastTapRef.current = now;
      }
    },
    [imageId, onRate, rating, handleRate],
  );

  // ── Render helpers ───────────────────────────────────────────────────────

  const hasMoreActions = !!((isR2Url && onEdit) || (imageId && onHide) || (imageId && onDelete));

  const moreMenuItems = (
    <>
      {isR2Url && onEdit && (
        <MenuAction
          icon={<Pencil className="size-4" style={{ color: "#E5A3F0" }} />}
          label="Editar con IA"
          hint="Kontext Pro · cambio de ropa, fondo, look"
          onClick={handleEditClick}
        />
      )}
      {imageId && onHide && (
        <MenuAction
          icon={
            isHidden ? (
              <ArchiveRestore className="size-4 text-white/80" />
            ) : (
              <Archive className="size-4 text-white/80" />
            )
          }
          label={isHidden ? "Restaurar" : "Archivar"}
          hint={isHidden ? "Volver a la galería principal" : "Mover a galería privada"}
          onClick={handleHideClick}
          disabled={hiding}
        />
      )}
      {imageId && onDelete && (
        <MenuAction
          icon={<Trash2 className="size-4 text-red-400" />}
          label="Eliminar"
          hint="Borrar permanentemente"
          danger
          onClick={handleDeleteClick}
        />
      )}
    </>
  );

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/92 backdrop-blur-md flex items-center justify-center"
        onClick={onClose}
      >
        {/* ── Top bar — solo 3 botones ─────────────────────────────── */}
        <div
          className="absolute inset-x-0 top-0 flex items-center justify-between px-4 z-10"
          style={{
            paddingTop: "calc(0.75rem + env(safe-area-inset-top, 0px))",
            paddingBottom: "0.75rem",
          }}
        >
          {/* Close (left) */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="w-11 h-11 rounded-full flex items-center justify-center text-white transition-all active:scale-90"
            style={{
              backgroundColor: "rgba(0, 0, 0, 0.6)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
            }}
            aria-label="Cerrar"
          >
            <X className="size-5" />
          </button>

          {/* Right side: Download + More */}
          <div className="flex items-center gap-3">
            {/* Download */}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (isR2Url) {
                    setDownloadOpen((o) => !o);
                    setMoreOpen(false);
                  } else {
                    handleLegacyDownload();
                  }
                }}
                className="w-11 h-11 rounded-full flex items-center justify-center text-white transition-all active:scale-90"
                style={{
                  backgroundColor: "rgba(0, 0, 0, 0.6)",
                  backdropFilter: "blur(12px)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                }}
                aria-label="Descargar imagen"
                aria-expanded={downloadOpen}
              >
                <Download className="size-5" />
              </button>
              <AnimatePresence>
                {downloadOpen && isR2Url && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.96 }}
                    transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute top-[52px] right-0 w-52 rounded-xl overflow-hidden border border-white/15 shadow-2xl"
                    style={{ backgroundColor: "#0f0f12" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="px-3 py-2 border-b border-white/10">
                      <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-white/50">
                        Descargar como
                      </span>
                    </div>
                    {DOWNLOAD_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => handleDownload(opt.value)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 transition-colors text-left"
                      >
                        <span
                          className="font-display font-bold text-lg leading-none w-6 text-center"
                          style={{ color: opt.color }}
                        >
                          {opt.mark}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-white">{opt.label}</div>
                          <div className="text-[10px] text-white/50 font-mono">{opt.hint}</div>
                        </div>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* More — opens dropdown on desktop, sheet on mobile */}
            {hasMoreActions && (
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    // On mobile use sheet, on desktop use dropdown
                    const isMobile = window.matchMedia("(max-width: 639px)").matches;
                    if (isMobile) {
                      setSheetOpen(true);
                    } else {
                      setMoreOpen((o) => !o);
                      setDownloadOpen(false);
                    }
                  }}
                  className="w-11 h-11 rounded-full flex items-center justify-center text-white transition-all active:scale-90"
                  style={{
                    backgroundColor: "rgba(0, 0, 0, 0.6)",
                    backdropFilter: "blur(12px)",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                  }}
                  aria-label="Más opciones"
                  aria-expanded={moreOpen}
                >
                  <MoreHorizontal className="size-5" />
                </button>
                {/* Desktop dropdown */}
                <AnimatePresence>
                  {moreOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.96 }}
                      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                      className="hidden sm:block absolute top-[52px] right-0 w-60 rounded-xl overflow-hidden border border-white/15 shadow-2xl"
                      style={{ backgroundColor: "#0f0f12" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {moreMenuItems}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>

        {/* ── Main image — double-tap to like ─────────────────────── */}
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <motion.img
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            src={displaySrc}
            alt="Vista completa"
            className="max-w-[95vw] max-h-[82vh] object-contain rounded-lg select-none cursor-pointer"
            onClick={handleImageTap}
            draggable={false}
          />
          {/* Heart burst animation on double-tap */}
          <AnimatePresence>
            {heartBurst && (
              <motion.div
                initial={{ opacity: 0, scale: 0.3 }}
                animate={{ opacity: [0, 1, 1, 0], scale: [0.3, 1.2, 1.1, 1.3] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8, times: [0, 0.2, 0.6, 1] }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
              >
                <Heart
                  className="size-24"
                  fill="#D4E94B"
                  style={{
                    color: "#D4E94B",
                    filter: "drop-shadow(0 0 24px rgba(212, 233, 75, 0.8))",
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Bottom star rating bar ────────────────────────────── */}
        {imageId && onRate && (
          <div
            className="absolute inset-x-0 flex flex-col items-center gap-2 z-10"
            style={{
              bottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 5 estrellas */}
            <div
              className="flex items-center gap-1 px-5 py-3 rounded-full"
              style={{
                backgroundColor: "rgba(0, 0, 0, 0.7)",
                backdropFilter: "blur(16px)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                boxShadow: "0 4px 24px rgba(0, 0, 0, 0.5)",
              }}
            >
              {([1, 2, 3, 4, 5] as const).map((star) => (
                <button
                  key={star}
                  onClick={() => handleRate(star)}
                  disabled={false}
                  aria-label={`${star} estrella${star > 1 ? "s" : ""}`}
                  className="p-1 transition-all active:scale-90 disabled:opacity-60"
                >
                  <Star
                    className="size-8 transition-all duration-200"
                    fill={star <= rating ? "#D4E94B" : "none"}
                    style={{
                      color: star <= rating ? "#D4E94B" : "rgba(255, 255, 255, 0.3)",
                      filter: star <= rating ? "drop-shadow(0 0 6px rgba(212, 233, 75, 0.5))" : "none",
                    }}
                  />
                </button>
              ))}
            </div>
            <span
              className="font-mono text-[9.5px] uppercase tracking-wider"
              style={{
                color: rating > 0 ? "#D4E94B" : "rgba(255,255,255,0.5)",
              }}
            >
              {rating === 0 ? "Calificar" : rating <= 2 ? "No me gusta" : rating === 3 ? "Está bien" : rating === 4 ? "Me gusta" : "Me encanta"}
            </span>
          </div>
        )}
      </motion.div>

      {/* ── Mobile bottom sheet (More actions) ──────────────────────── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="bottom"
          className="sm:hidden border-t border-white/10 rounded-t-2xl"
          style={{ backgroundColor: "#0f0f12" }}
        >
          <SheetHeader>
            <SheetTitle className="text-white text-center text-sm font-medium">
              Más opciones
            </SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-0 mt-2">
            {moreMenuItems}
          </div>
          <div className="pt-3 pb-1">
            <Button
              variant="ghost"
              className="w-full text-white/70 hover:text-white hover:bg-white/5"
              onClick={() => setSheetOpen(false)}
            >
              Cancelar
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Dialog de confirmación de delete ───────────────────────── */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[420px] bg-bg-elevated border-border">
          <DialogHeader>
            <DialogTitle className="text-text">¿Eliminar esta imagen?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-text-muted">
            La imagen se eliminará permanentemente de tu galería. Esta acción no se
            puede deshacer.
          </p>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="ghost"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-danger hover:bg-danger/90 text-white"
            >
              {deleting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Eliminar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ─── Menu action item (used in desktop dropdown + mobile sheet) ─── */

function MenuAction({
  icon,
  label,
  hint,
  onClick,
  disabled,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-3 px-4 py-3.5 transition-colors text-left disabled:opacity-60 ${
        danger
          ? "border-t border-white/10 hover:bg-red-500/10 active:bg-red-500/15"
          : "hover:bg-white/5 active:bg-white/10"
      }`}
    >
      <div className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-white/5">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div
          className={`text-sm font-medium ${
            danger ? "text-red-300" : "text-white"
          }`}
        >
          {label}
        </div>
        {hint && (
          <div className="text-[11px] text-white/50 leading-tight mt-0.5 truncate">
            {hint}
          </div>
        )}
      </div>
    </button>
  );
}
