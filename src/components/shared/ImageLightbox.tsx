import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { Download, Wand2, X } from "lucide-react";
import { downloadOrShareImage } from "@/lib/downloadImage";
import { useModalBack } from "@/hooks/useModalBack";
import { toast } from "sonner";

/**
 * ImageLightbox — viewer fullscreen para imágenes del chat (S163).
 *
 * Tap en imagen del chat → overlay con la imagen ORIGINAL (full-res, no la
 * variante CF) + botón Descargar/Compartir (share sheet iOS → "Guardar
 * imagen" a Fotos). Mismo lenguaje visual que el viewer de la galería.
 *
 * S164 (fix "aparece un scroll y no puedo volver atrás"):
 *   - createPortal a body — antes se montaba DENTRO de la lista scrolleable
 *     (ChatSurface overflow-y-auto) y en iOS el drag sobre el overlay
 *     encadenaba el scroll al chat de atrás.
 *   - touch-action/overscroll lock en el backdrop.
 *   - useModalBack: el gesto "atrás" de iOS cierra el visor en vez de
 *     navegar la app.
 */
export function ImageLightbox({
  url,
  onClose,
}: {
  url: string;
  onClose: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const close = useModalBack(onClose);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", handler);
    // Scroll-lock del documento mientras el visor está abierto
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.documentElement.style.overflow = prevOverflow;
    };
  }, [close]);

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

  /**
   * S209 — "Editar esta".
   *
   * Antes no había forma de decirle a Noa CUÁL imagen editar: si el turno
   * había dejado varias, la edición caía siempre sobre la última de la sesión
   * y volvía con el diseño equivocado. Acá se manda la URL exacta, que es lo
   * que `edit_image_smart` acepta como referencia.
   */
  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(
      new CustomEvent("noa-edit-image", { detail: { url } }),
    );
    close();
    toast.info("Escribí qué querés cambiar de esta imagen");
  };

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex items-center justify-center p-4"
      style={{ touchAction: "none", overscrollBehavior: "contain" }}
      onClick={close}
    >
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

      <img
        src={url}
        alt=""
        className="max-w-full max-h-[82vh] rounded-2xl object-contain shadow-2xl"
        style={{ touchAction: "pinch-zoom" }}
        onClick={(e) => e.stopPropagation()}
      />

      <div className="absolute left-1/2 -translate-x-1/2 bottom-[calc(var(--sab)+1.5rem)] flex items-center gap-2">
        <button
          onClick={handleDownload}
          disabled={saving}
          className="flex items-center gap-2 h-11 px-5 rounded-full bg-black/65 hover:bg-black/85 backdrop-blur-xl border border-white/15 shadow-[0_4px_20px_rgba(0,0,0,0.55)] transition-all active:scale-95 text-[13px] font-medium text-white disabled:opacity-60"
        >
          <Download className="size-4" />
          <span>{saving ? "Guardando…" : "Descargar"}</span>
        </button>

        <button
          onClick={handleEdit}
          className="flex items-center gap-2 h-11 px-5 rounded-full bg-white/95 hover:bg-white backdrop-blur-xl border border-white/20 shadow-[0_4px_20px_rgba(0,0,0,0.55)] transition-all active:scale-95 text-[13px] font-semibold text-black"
        >
          <Wand2 className="size-4" />
          <span>Editar esta</span>
        </button>
      </div>
    </motion.div>,
    document.body,
  );
}
