import { motion } from "framer-motion";
import { AgentAvatar } from "@/components/shared/AgentAvatar";
import { Loader2 } from "lucide-react";
import type { Agent } from "@/hooks/useChat";

interface Props {
  agent: Agent;
  loadingHint?: string | null;
}

export function TypingIndicator({ agent, loadingHint }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-2.5 mb-3"
    >
      <AgentAvatar agent={agent} size="sm" />
      <div className="pt-1">
        {loadingHint ? (
          <div className="flex items-center gap-2">
            <Loader2 className={`h-4 w-4 animate-spin ${agent === "kronos" ? "text-kronos" : "text-kira"}`} />
            <span className="text-xs text-text-muted">{loadingHint}</span>
          </div>
        ) : (
          <div className="flex gap-1 pt-1">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="w-[7px] h-[7px] bg-text-muted/50 rounded-full"
                animate={{ y: [0, -6, 0] }}
                transition={{
                  duration: 0.6,
                  repeat: Infinity,
                  delay: i * 0.15,
                  ease: "easeInOut",
                }}
              />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
