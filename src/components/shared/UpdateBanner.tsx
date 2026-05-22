import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, X } from "lucide-react";
import { applyServiceWorkerUpdate } from "@/lib/sw";
import { Button } from "@/components/ui/Button";

/**
 * UpdateBanner — toast persistent en bottom-right cuando hay nueva versión PWA.
 *
 * Se dispara via window event "sw-update-available" emitido por el SW registration.
 * Usuario puede actualizar (skipWaiting + reload) o dismiss.
 */
export function UpdateBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handler = () => setShow(true);
    window.addEventListener("sw-update-available", handler);
    return () => window.removeEventListener("sw-update-available", handler);
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed bottom-4 right-4 z-50 max-w-xs"
        >
          <div className="card-glass p-4 flex items-start gap-3">
            <RefreshCw className="size-5 text-[var(--color-noa)] mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white font-medium">Nueva versión disponible</p>
              <p className="text-[12px] text-white/55 mt-0.5">
                Actualizá para obtener las últimas mejoras
              </p>
              <div className="flex items-center gap-2 mt-3">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={applyServiceWorkerUpdate}
                >
                  Actualizar
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShow(false)}>
                  Más tarde
                </Button>
              </div>
            </div>
            <button
              onClick={() => setShow(false)}
              className="text-white/40 hover:text-white/80 transition shrink-0"
              aria-label="Cerrar"
            >
              <X className="size-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
