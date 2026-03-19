import { motion } from "framer-motion";
import { AIStarIcon } from "@/components/shared/AIStarIcon";
import type { Agent } from "@/hooks/useChat";

interface Props {
  agent: Agent;
  loadingHint?: string | null;
}

export function TypingIndicator({ agent: _agent, loadingHint }: Props) {
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

      <div className="flex items-center gap-1 h-7">
        {loadingHint ? (
          <span className="text-xs text-text-muted">{loadingHint}</span>
        ) : (
          [0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-text-muted"
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
