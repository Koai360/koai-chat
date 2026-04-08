import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { X, Download, Trash2, Loader2 } from "lucide-react";

interface Props {
  src: string;
  /** Optional: si está presente, muestra botón de eliminar */
  imageId?: string;
  /** Callback de eliminar — debe llamar al backend, actualizar lista, y onClose */
  onDelete?: (id: string) => Promise<void>;
  onClose: () => void;
}

export function ImageViewer({ src, imageId, onDelete, onClose }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [onClose]);

  // Reset confirm state when image changes
  useEffect(() => {
    setConfirming(false);
    setDeleting(false);
  }, [src, imageId]);

  const handleDownload = useCallback(async () => {
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `koai-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      // Fallback: open in new tab
      window.open(src, "_blank");
    }
  }, [src]);

  const handleDeleteClick = useCallback(async () => {
    if (!imageId || !onDelete) return;

    if (!confirming) {
      // Primer tap → entrar en modo confirmar
      setConfirming(true);
      if (navigator.vibrate) navigator.vibrate(15);
      // Auto-cancel después de 4s si no confirma
      setTimeout(() => setConfirming(false), 4000);
      return;
    }

    // Segundo tap → eliminar de verdad
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
        {/* Delete (solo si hay imageId + onDelete) */}
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

        {/* Download */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleDownload();
          }}
          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          aria-label="Descargar imagen"
        >
          <Download className="h-[18px] w-[18px]" />
        </button>

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
        src={src}
        alt="Vista completa"
        className="max-w-[95vw] max-h-[90vh] object-contain rounded-lg select-none"
        onClick={(e) => e.stopPropagation()}
        draggable={false}
      />
    </motion.div>
  );
}
