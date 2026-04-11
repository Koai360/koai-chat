import { motion } from "framer-motion";
import { AIStarIcon } from "@/components/shared/AIStarIcon";

export function SplashScreen() {
  return (
    <motion.div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden"
      style={{
        background: "radial-gradient(ellipse at 40% 30%, rgba(197, 227, 74, 0.06) 0%, transparent 50%), radial-gradient(ellipse at 60% 70%, rgba(123, 45, 142, 0.05) 0%, transparent 50%), var(--color-bg)",
      }}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Ambient orb */}
      <motion.div
        className="absolute w-80 h-80 rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(197, 227, 74, 0.08) 0%, transparent 70%)",
          filter: "blur(60px)",
        }}
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 1.5, ease: "easeOut" }}
      />

      {/* AIStarIcon — lens focus effect */}
      <div style={{ filter: "drop-shadow(0 0 40px rgba(197, 227, 74, 0.25))" }}>
        <motion.div
          initial={{ scale: 0.7, opacity: 0, filter: "blur(12px)" }}
          animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
          transition={{ delay: 0.3, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <AIStarIcon size="lg" />
        </motion.div>
      </div>

      {/* Brand text — staggered fadeUp+blur */}
      <motion.div
        className="text-center mt-6"
        initial={{ y: 30, opacity: 0, filter: "blur(8px)" }}
        animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
        transition={{ delay: 0.6, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <h1 className="text-[24px] tracking-tight mb-1 font-display">
          <span className="gradient-text-kira">Noa</span>
        </h1>
      </motion.div>

      <motion.p
        className="text-[12px] text-text-muted font-display"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9, duration: 0.4 }}
      >
        by KOAI Studios
      </motion.p>

      {/* Loading dots */}
      <motion.div
        className="flex items-center gap-1.5 mt-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.1 }}
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
