import { motion } from "framer-motion";

export function LoadingScreen() {
  return (
    <div className="h-full flex flex-col items-center justify-center bg-bg">
      <motion.img
        src="/icons/noa-logo.svg"
        alt="KOAI"
        className="w-20 h-20 rounded-2xl shadow-lg"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      />
      <motion.p
        className="mt-4 text-sm text-text-muted"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        Cargando...
      </motion.p>
    </div>
  );
}
