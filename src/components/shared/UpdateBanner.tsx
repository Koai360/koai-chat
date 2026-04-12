import { motion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  onUpdate: () => void;
}

export function UpdateBanner({ onUpdate }: Props) {
  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed bottom-20 left-4 right-4 z-[100] safe-bottom"
    >
      <div className="bg-noa text-bg rounded-2xl shadow-2xl shadow-noa/20 flex items-center justify-center gap-3 py-3 px-5">
        <RefreshCw className="h-4 w-4" />
        <span className="text-sm font-semibold">Nueva versión disponible</span>
        <Button
          onClick={onUpdate}
          size="sm"
          className="bg-brand hover:bg-brand/90 text-white rounded-full px-5 h-7 text-xs font-bold"
        >
          Actualizar
        </Button>
      </div>
    </motion.div>
  );
}
