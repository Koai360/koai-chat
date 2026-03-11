import { motion } from "framer-motion";

export function SplashScreen() {
  return (
    <motion.div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center"
      style={{ backgroundColor: "#1A0A33" }}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Glow */}
      <motion.div
        className="absolute rounded-full blur-[80px]"
        style={{ width: 200, height: 200, backgroundColor: "rgba(197,227,74,0.33)" }}
        animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Orb */}
      <motion.div
        className="relative w-20 h-20 rounded-full flex items-center justify-center mb-6"
        style={{
          background: "linear-gradient(135deg, #C5E34A, #C5E34A88)",
          boxShadow: "0 0 60px rgba(197,227,74,0.4)",
        }}
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <span className="text-3xl font-medium" style={{ color: "#1A0A33" }}>K</span>
      </motion.div>

      {/* Brand text */}
      <motion.div
        className="text-center"
        initial={{ y: 15, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
      >
        <h1 className="text-[22px] tracking-tight mb-1 text-text">Kira</h1>
        <p className="text-[12px] text-text-muted">by KOAI Studios</p>
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
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: "#C5E34A" }}
            animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.1, 0.8] }}
            transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </motion.div>
    </motion.div>
  );
}
