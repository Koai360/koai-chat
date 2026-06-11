import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Download, X } from "lucide-react";
import { downloadOrShareImage } from "@/lib/downloadImage";
import { toast } from "sonner";

/**
 * ImageLightbox — viewer fullscreen para imágenes del chat (S163).
 *
 * Tap en imagen del chat → overlay con la imagen ORIGINAL (full-res, no la
 * variante CF) + botón Descargar/Compartir (share sheet iOS → "Guardar
 * imagen" a Fotos). Mismo lenguaje visual que el viewer de la galería.
 */
export function ImageLightbox({
  url,
  onClose,
}: {
  url: string;
  onClose: () => void;
}) {
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (saving) return;
    setSaving(true);
    try {
      const result = await downloadOrShareImage(url);
      if (result === "downloaded") toast.success("Imagen descargada");
      if (result === "opened")
        toast.info("Abrí la imagen — mantenela presionada para guardarla");
    } catch {
      toast.error("No se pudo descargar — intentá de nuevo");
    } finally {
      setSaving(false);
    }
  };

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
        className="absolute right-4 size-11 rounded-full bg-black/65 hover:bg-black/85 backdrop-blur-xl border border-white/15 shadow-[0_4px_20px_rgba(0,0,0,0.55)] flex items-center justify-center transition-all active:scale-95 top-[calc(env(safe-area-inset-top,0px)+1rem)]"
        aria-label="Cerrar"
      >
        <X className="size-5 text-white" strokeWidth={2.5} />
      </button>

      <img
        src={url}
        alt=""
        className="max-w-full max-h-[82vh] rounded-2xl object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />

      <button
        onClick={handleDownload}
        disabled={saving}
        className="absolute left-1/2 -translate-x-1/2 bottom-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] flex items-center gap-2 h-11 px-5 rounded-full bg-black/65 hover:bg-black/85 backdrop-blur-xl border border-white/15 shadow-[0_4px_20px_rgba(0,0,0,0.55)] transition-all active:scale-95 text-[13px] font-medium text-white disabled:opacity-60"
      >
        <Download className="size-4" />
        <span>{saving ? "Guardando…" : "Descargar"}</span>
      </button>
    </motion.div>
  );
}
