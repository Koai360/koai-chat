import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface Props {
  agent: "kira" | "kronos";
  onChange: (agent: "kira" | "kronos") => void;
  disabled?: boolean;
}

export function AgentToggle({ agent, onChange, disabled }: Props) {
  return (
    <div className="relative flex items-center bg-bg-surface rounded-full p-1 gap-0.5">
      {(["kira", "kronos"] as const).map((a) => (
        <button
          key={a}
          onClick={() => !disabled && onChange(a)}
          disabled={disabled}
          className={cn(
            "relative z-10 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors duration-200",
            agent === a ? "text-bg" : "text-text-muted hover:text-text",
            disabled && "opacity-50 cursor-not-allowed",
          )}
        >
          <span
            className={cn(
              "w-1.5 h-1.5 rounded-full transition-colors",
              agent === a
                ? a === "kira" ? "bg-bg" : "bg-bg"
                : a === "kira" ? "bg-kira" : "bg-kronos",
            )}
          />
          {a === "kira" ? "Kira" : "Kronos"}
        </button>
      ))}

      {/* Sliding pill indicator */}
      <motion.div
        layoutId="agent-pill"
        className={cn(
          "absolute top-1 bottom-1 rounded-full",
          agent === "kira" ? "bg-kira" : "bg-kronos",
        )}
        style={{
          left: agent === "kira" ? 4 : "50%",
          right: agent === "kira" ? "50%" : 4,
        }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
      />
    </div>
  );
}
