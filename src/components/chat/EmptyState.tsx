import { motion } from "framer-motion";
import type { Agent } from "@/hooks/useChat";

interface Props {
  agent: Agent;
  userName?: string;
  onSend: (text: string) => void;
  loading: boolean;
}

const AGENT_LIME = { kira: "#C5E34A", kronos: "#00E5FF" };
const AGENT_BG = { kira: "#1A0A33", kronos: "#000000" };

const SUGGESTIONS = {
  kira: [
    "Qué tengo pendiente hoy?",
    "Estado de los pedidos",
    "Cotizar stickers personalizados",
  ],
  kronos: [
    "Estado del sistema",
    "Resumen de la arquitectura",
    "Qué endpoints tiene la API?",
  ],
};

export function EmptyState({ agent, onSend, loading }: Props) {
  const lime = AGENT_LIME[agent];
  const bgDeep = AGENT_BG[agent];
  const isKronos = agent === "kronos";
  const suggestions = SUGGESTIONS[agent];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="flex-1 flex flex-col items-center justify-center px-6 pb-32"
    >
      {/* Logo orb with glow */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="mb-8 relative"
      >
        {/* Animated glow */}
        <motion.div
          className="absolute inset-0 rounded-full blur-3xl scale-150"
          style={{ backgroundColor: `${lime}4d` }}
          animate={{
            scale: [1.5, 1.7, 1.5],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Orb */}
        <div
          className="relative w-24 h-24 rounded-full flex items-center justify-center"
          style={{
            background: isKronos
              ? `linear-gradient(135deg, ${lime}, #0088AA)`
              : `linear-gradient(135deg, ${lime}, ${lime}99)`,
            boxShadow: `0 0 60px ${lime}66`,
          }}
        >
          <span
            className="text-4xl font-medium tracking-tight"
            style={{ color: bgDeep }}
          >
            {isKronos ? "Kr" : "K"}
          </span>
        </div>
      </motion.div>

      <motion.h2
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="text-[28px] font-light mb-8 text-center tracking-tight text-text"
      >
        How can I help you today?
      </motion.h2>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="flex flex-col gap-3 w-full max-w-sm"
      >
        {suggestions.map((suggestion, index) => (
          <motion.button
            key={suggestion}
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.4 + index * 0.1, duration: 0.4 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => !loading && onSend(suggestion)}
            disabled={loading}
            className="px-5 py-3.5 rounded-2xl text-left w-full transition-colors active:opacity-70 disabled:opacity-50"
            style={{
              backgroundColor: "#271648",
              border: "1px solid rgba(91,45,140,0.30)",
            }}
          >
            <p className="text-[14px] leading-[1.4] text-text">{suggestion}</p>
          </motion.button>
        ))}
      </motion.div>
    </motion.div>
  );
}
