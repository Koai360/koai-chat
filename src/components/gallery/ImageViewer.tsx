import { useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { X, Download } from "lucide-react";

interface Props {
  src: string;
  onClose: () => void;
}

export function ImageViewer({ src, onClose }: Props) {
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [onClose]);

  const handleDownload = useCallback(() => {
    const a = document.createElement("a");
    a.href = src;
    a.download = `koai-${Date.now()}.png`;
    a.click();
  }, [src]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute top-4 right-4 flex gap-2 z-10 safe-top">
        <button
          onClick={(e) => { e.stopPropagation(); handleDownload(); }}
          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
        >
          <Download className="h-4.5 w-4.5" />
        </button>
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
        >
          <X className="h-4.5 w-4.5" />
        </button>
      </div>
      <motion.img
        initial={{ scale: 0.9 }}
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
