import { motion } from "framer-motion";
import { AIStarIcon } from "@/components/shared/AIStarIcon";

export function SplashScreen() {
  return (
    <motion.div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-bg"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Pulsing AIStarIcon */}
      <motion.div
        animate={{ scale: [1, 1.06, 1], opacity: [0.85, 1, 0.85] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <AIStarIcon size="lg" />
      </motion.div>

      {/* Brand text */}
      <motion.div
        className="text-center mt-6"
        initial={{ y: 15, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
      >
        <h1 className="text-[22px] tracking-tight mb-1 text-text font-display">Kira</h1>
        <p className="text-[12px] text-text-muted font-display">by KOAI Studios</p>
      </motion.div>

      {/* Loading dots */}
      <motion.div
        className="flex items-center gap-1.5 mt-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-kira"
            animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.1, 0.8] }}
            transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </motion.div>
    </motion.div>
  );
}
