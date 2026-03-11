import { motion } from "framer-motion";
import type { Agent } from "@/hooks/useChat";

const AGENT_LIME = { kira: "#C5E34A", kronos: "#00E5FF" };
const AGENT_LABEL = { kira: "K", kronos: "Kr" };

interface Props {
  agent: Agent;
  loadingHint?: string | null;
}

export function TypingIndicator({ agent, loadingHint }: Props) {
  const lime = AGENT_LIME[agent];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-2.5 px-4 mb-3"
    >
      {/* Avatar */}
      <div
        className="flex-shrink-0 w-7 h-7 mt-0.5 rounded-full flex items-center justify-center relative"
        style={{ backgroundColor: `${lime}1a` }}
      >
        <div
          className="absolute inset-0 rounded-full blur-md animate-pulse"
          style={{ backgroundColor: `${lime}4d` }}
        />
        <span className="relative text-[11px] font-medium" style={{ color: lime }}>
          {AGENT_LABEL[agent]}
        </span>
      </div>

      <div className="flex items-center gap-1 h-7">
        {loadingHint ? (
          <span className="text-xs text-text-muted">{loadingHint}</span>
        ) : (
          [0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-1.5 h-1.5 rounded-full"
              style={{
                backgroundColor: lime,
                boxShadow: `0 0 8px ${lime}99`,
              }}
              animate={{
                opacity: [0.3, 1, 0.3],
                scale: [0.8, 1, 0.8],
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
