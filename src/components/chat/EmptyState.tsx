import { motion } from "framer-motion";
import { FileText, PenTool, Zap } from "lucide-react";
import { AIStarIcon } from "@/components/shared/AIStarIcon";
import type { Agent } from "@/hooks/useChat";

interface Props {
  agent: Agent;
  userName?: string;
  onSend: (text: string) => void;
  loading: boolean;
}

const SUGGESTIONS = [
  {
    icon: FileText,
    title: "Resumir",
    description: "Condensa textos largos en puntos clave",
    prompt: "Resúmeme los puntos clave de este tema",
  },
  {
    icon: PenTool,
    title: "Escribir",
    description: "Genera contenido creativo y copy",
    prompt: "Ayúdame a escribir contenido creativo",
  },
  {
    icon: Zap,
    title: "Preguntar",
    description: "Respuestas rápidas a cualquier pregunta",
    prompt: "Respóndeme sobre cualquier tema",
  },
];

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Buenos días";
  if (hour < 17) return "Buenas tardes";
  return "Buenas noches";
}

export function EmptyState({ agent, userName, onSend, loading }: Props) {
  const greeting = getGreeting();
  const displayName = userName?.split(" ")[0] || (agent === "kronos" ? "Boss" : "");

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="flex-1 flex flex-col items-center justify-center px-6 pb-20 md:pb-32"
    >
      {/* AI Star with glow */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0, filter: "blur(10px)" }}
        animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
        transition={{ duration: 0.6 }}
        className="mb-6"
        style={{ filter: "drop-shadow(0 0 30px rgba(197, 227, 74, 0.2))" }}
      >
        <AIStarIcon size="lg" />
      </motion.div>

      {/* Greeting */}
      <motion.div
        initial={{ y: 30, opacity: 0, filter: "blur(8px)" }}
        animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
        transition={{ delay: 0.2, duration: 0.6 }}
        className="text-center mb-10"
      >
        <h2 className="text-[24px] md:text-[32px] font-medium text-text leading-tight font-display">
          {greeting}
          {displayName ? (
            <>
              ,{" "}
              <span className={agent === "kronos" ? "gradient-text-kronos" : "gradient-text-kira"}>
                {displayName}
              </span>
            </>
          ) : ""}
        </h2>
        <h2 className="text-[24px] md:text-[32px] font-medium text-text-muted leading-tight font-display">
          ¿En qué puedo ayudarte?
        </h2>
      </motion.div>

      {/* Suggestion Cards — liquid glass */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.5 }}
        className="flex flex-col md:flex-row gap-3 w-full max-w-2xl overflow-x-auto md:overflow-visible no-scrollbar"
      >
        {SUGGESTIONS.map((suggestion, index) => (
          <motion.button
            key={suggestion.title}
            initial={{ y: 20, opacity: 0, filter: "blur(4px)" }}
            animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
            transition={{ delay: 0.5 + index * 0.1, duration: 0.4 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => !loading && onSend(suggestion.prompt)}
            disabled={loading}
            className="flex-1 min-w-[180px] liquid-glass-strong rounded-2xl p-4 text-left transition-all duration-300 hover:scale-[1.02] disabled:opacity-50"
          >
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center mb-3"
              style={{
                background: agent === "kronos" ? "rgba(0,229,255,0.12)" : "rgba(197,227,74,0.12)",
              }}
            >
              <suggestion.icon
                className="h-4 w-4"
                style={{ color: agent === "kronos" ? "#00E5FF" : "#C5E34A" }}
              />
            </div>
            <div className="text-sm font-medium text-text font-display">{suggestion.title}</div>
            <div className="text-xs text-text-muted mt-1">{suggestion.description}</div>
          </motion.button>
        ))}
      </motion.div>
    </motion.div>
  );
}
