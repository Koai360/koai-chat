import { motion } from "framer-motion";
import type { Agent } from "@/hooks/useChat";

interface Props {
  agent: Agent;
  userName?: string;
  onSend: (text: string) => void;
  loading: boolean;
}

function getGreeting(name?: string): string {
  const hour = new Date().getHours();
  const displayName = name || "Usuario";
  if (hour < 12) return `Buenos días, ${displayName}`;
  if (hour < 18) return `Buenas tardes, ${displayName}`;
  return `Buenas noches, ${displayName}`;
}

function getSuggestions(agent: Agent): string[] {
  const hour = new Date().getHours();
  if (agent === "kronos") {
    return [
      "Estado del sistema",
      "Resumen de la arquitectura",
      "Qué endpoints tiene la API?",
    ];
  }
  if (hour < 12) {
    return [
      "Qué tengo pendiente hoy?",
      "Resumen de mensajes nuevos",
      "Cotizar stickers personalizados",
    ];
  }
  if (hour < 18) {
    return [
      "Estado de los pedidos",
      "Genera una imagen para un post",
      "Cotizar stickers personalizados",
    ];
  }
  return [
    "Resumen de lo que se hizo hoy",
    "Qué quedó pendiente?",
    "Programa una tarea para mañana",
  ];
}

export function EmptyState({ agent, userName, onSend, loading }: Props) {
  const suggestions = getSuggestions(agent);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="flex flex-col items-center justify-center h-full text-center px-6"
    >
      {/* Logo with glow */}
      <div className="relative mb-5">
        <div
          className="absolute inset-0 rounded-xl blur-lg opacity-25"
          style={{
            background: agent === "kira"
              ? "oklch(0.78 0.19 135)"
              : "oklch(0.58 0.22 290)",
          }}
        />
        <img
          src={agent === "kira" ? "/icons/kira-logo.svg" : "/icons/kronos-logo.svg"}
          alt={agent === "kira" ? "Kira" : "Kronos"}
          className="relative w-14 h-14 rounded-xl"
        />
      </div>

      <h2 className="text-lg font-semibold text-text mb-1">
        {getGreeting(userName)}
      </h2>
      <p className="text-sm text-text-muted max-w-xs mb-8">
        {agent === "kira"
          ? "Soy Kira, tu asistente de KOAI Studios"
          : "Soy Kronos, arquitecto de código"}
      </p>

      {/* Suggestion chips */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-md w-full">
        {suggestions.map((s, i) => (
          <motion.button
            key={s}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.05 }}
            onClick={() => onSend(s)}
            disabled={loading}
            className="px-4 py-3 rounded-xl border border-border-subtle text-[13px] text-text-muted hover:bg-bg-surface hover:text-text hover:border-border-subtle/80 transition-all disabled:opacity-50 active:scale-[0.98] text-left"
          >
            {s}
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}
