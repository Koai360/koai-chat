import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download, Trash2, Loader2, Pencil } from "lucide-react";
import { getCfTransformUrl, getOriginalUrl, triggerDownload } from "@/lib/cfTransform";

interface Props {
  src: string;
  /** Optional: si está presente, muestra botón de eliminar */
  imageId?: string;
  /** Callback de eliminar — debe llamar al backend, actualizar lista, y onClose */
  onDelete?: (id: string) => Promise<void>;
  /** Callback de editar — abre ChatInput en modo edit con la URL */
  onEdit?: (imageUrl: string) => void;
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
  { value: "original", label: "Original", hint: "PNG lossless nativo", mark: "∞", color: "#E5A3F0" },
];

export function ImageViewer({ src, imageId, onDelete, onEdit, onClose }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);

  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (downloadOpen) setDownloadOpen(false);
        else onClose();
      }
    };
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [onClose, downloadOpen]);

  // Reset state when image changes
  useEffect(() => {
    setConfirming(false);
    setDeleting(false);
    setDownloadOpen(false);
  }, [src, imageId]);

  const isR2Url = src.startsWith("https://cdn.koai360.com/") || src.startsWith("https://refnipatiiyddkuxjqaf.supabase.co/");

  // Display source: usar CF Transform fullscreen (2048px q95) si es URL R2,
  // sino la URL directa (fallback para legacy o base64).
  const displaySrc = isR2Url ? getCfTransformUrl(src, "fullscreen") : src;

  const handleDownload = useCallback(
    (variant: DownloadVariant) => {
      const url =
        variant === "original"
          ? getOriginalUrl(src)
          : getCfTransformUrl(src, variant);

      const ext = variant === "original" ? "png" : "jpg";
      const filename = `koai-${Date.now()}-${variant}.${ext}`;
      triggerDownload(url, filename);
      setDownloadOpen(false);
      if (navigator.vibrate) navigator.vibrate(10);
    },
    [src],
  );

  // Fallback para imágenes legacy no-URL (base64)
  const handleLegacyDownload = useCallback(async () => {
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `koai-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      window.open(src, "_blank");
    }
  }, [src]);

  const handleDeleteClick = useCallback(async () => {
    if (!imageId || !onDelete) return;

    if (!confirming) {
      setConfirming(true);
      if (navigator.vibrate) navigator.vibrate(15);
      setTimeout(() => setConfirming(false), 4000);
      return;
    }

    setDeleting(true);
    try {
      await onDelete(imageId);
      onClose();
    } catch (err) {
      console.error("[ImageViewer] Delete failed:", err);
      setDeleting(false);
      setConfirming(false);
    }
  }, [confirming, imageId, onDelete, onClose]);

  const handleEditClick = useCallback(() => {
    if (!onEdit) return;
    if (navigator.vibrate) navigator.vibrate(8);
    onEdit(getOriginalUrl(src));
    onClose();
  }, [onEdit, src, onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center"
      onClick={onClose}
    >
      {/* Top right action buttons */}
      <div
        className="absolute top-0 right-0 flex gap-2 p-4 z-10"
        style={{ paddingTop: "calc(1rem + env(safe-area-inset-top, 0px))" }}
      >
        {/* Edit (solo para URLs R2 donde sabemos el original lossless) */}
        {isR2Url && onEdit && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleEditClick();
            }}
            className="h-10 px-3 rounded-full flex items-center gap-1.5 text-white text-xs font-medium transition-all active:scale-95 bg-[rgba(123,45,142,0.55)] hover:bg-[rgba(123,45,142,0.75)]"
            aria-label="Editar esta imagen con Kontext"
          >
            <Pencil className="h-[14px] w-[14px]" />
            <span>Editar</span>
          </button>
        )}

        {/* Delete */}
        {imageId && onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteClick();
            }}
            disabled={deleting}
            className="h-10 px-3 rounded-full flex items-center gap-1.5 text-white text-xs font-medium transition-all active:scale-95 disabled:opacity-60"
            style={{
              background: confirming ? "rgba(220,38,38,0.95)" : "rgba(220,38,38,0.55)",
              boxShadow: confirming ? "0 0 0 2px rgba(220,38,38,0.4)" : "none",
            }}
            aria-label={confirming ? "Confirmar eliminar" : "Eliminar imagen"}
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            <span>{confirming ? "Confirmar" : "Eliminar"}</span>
          </button>
        )}

        {/* Download (con menú si es URL R2, fallback si legacy base64) */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (isR2Url) {
                setDownloadOpen((o) => !o);
              } else {
                handleLegacyDownload();
              }
            }}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            aria-label="Descargar imagen"
          >
            <Download className="h-[18px] w-[18px]" />
          </button>

          {/* Download menu dropdown */}
          <AnimatePresence>
            {downloadOpen && isR2Url && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.96 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="absolute top-12 right-0 w-52 rounded-xl overflow-hidden border border-white/15 shadow-2xl"
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

        {/* Close */}
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          aria-label="Cerrar"
        >
          <X className="h-[18px] w-[18px]" />
        </button>
      </div>

      <motion.img
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        src={displaySrc}
        alt="Vista completa"
        className="max-w-[95vw] max-h-[90vh] object-contain rounded-lg select-none"
        onClick={(e) => e.stopPropagation()}
        draggable={false}
      />
    </motion.div>
  );
}
