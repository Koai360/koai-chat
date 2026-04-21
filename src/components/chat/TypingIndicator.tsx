import { motion } from "framer-motion";
import { AIStarIcon } from "@/components/shared/AIStarIcon";
import type { Agent } from "@/hooks/useChat";

interface Props {
  agent: Agent;
  loadingHint?: string | null;
}

export function TypingIndicator({ agent, loadingHint }: Props) {
  // Identidad del agente: Noa lime / Kronos cyan. Los dots pulsantes
  // reflejan quién está "pensando" — no son gris genérico.
  const accentColor = agent === "kronos" ? "#00E5FF" : "#D4E94B";
  const glowColor = agent === "kronos" ? "rgba(0,229,255,0.45)" : "rgba(212,233,75,0.45)";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-3 px-4 mb-3"
    >
      {/* AI Star Icon */}
      <div className="flex-shrink-0 mt-0.5">
        <AIStarIcon size="sm" />
      </div>

      <div className="flex items-center gap-1.5 h-7">
        {loadingHint ? (
          <span className="text-xs text-text-muted">{loadingHint}</span>
        ) : (
          [0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: accentColor }}
              animate={{
                opacity: [0.4, 1, 0.4],
                scale: [0.85, 1.05, 0.85],
                boxShadow: [
                  `0 0 0px ${glowColor}`,
                  `0 0 6px ${glowColor}`,
                  `0 0 0px ${glowColor}`,
                ],
              }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                delay: i * 0.2,
              }}
            />
          ))
        )}
      </div>
    </motion.div>
  );
}
