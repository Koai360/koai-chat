import { Plus } from "lucide-react";
import type { Agent, ThinkingLevel } from "@/hooks/useChat";
import type { AuthUser } from "@/hooks/useAuth";
import type { Page } from "@/hooks/useNavigation";
import { ThinkingLevelSelector } from "@/components/chat/ThinkingLevelSelector";

interface Props {
  agent: Agent;
  onAgentChange: (agent: Agent) => void;
  agentDisabled: boolean;
  thinkingLevel: ThinkingLevel;
  onThinkingLevelChange: (level: ThinkingLevel) => void;
  onNewConversation: () => void;
  user: AuthUser;
  // Mantenemos las props por compatibilidad pero ya no se usan visualmente
  theme?: "dark" | "light";
  onToggleTheme?: () => void;
  onNavigate?: (page: Page) => void;
}

/**
 * ContentTopBar — barra superior con:
 * - Toggle Kira ↔ Kronos (segmented control, no dropdown)
 * - Botón "Nueva conversación"
 * - Avatar usuario → Settings
 *
 * Tema dark fijo (toggle eliminado por decisión de producto).
 */
export function ContentTopBar({
  agent,
  onAgentChange,
  agentDisabled,
  thinkingLevel,
  onThinkingLevelChange,
  onNewConversation,
  user,
  onNavigate,
}: Props) {
  return (
    <div
      className="flex items-center px-3 sm:px-4 shrink-0 bg-bg gap-2"
      style={{
        paddingTop: "env(safe-area-inset-top, 0px)",
        minHeight: "calc(56px + env(safe-area-inset-top, 0px))",
      }}
    >
      {/* Toggle Kira ↔ Kronos — segmented control */}
      <div
        role="radiogroup"
        aria-label="Seleccionar agente"
        className="inline-flex items-center h-10 p-1 rounded-full border border-border bg-bg-surface"
      >
        {(["kira", "kronos"] as const).map((opt) => {
          const isActive = agent === opt;
          const label = opt === "kira" ? "Kira" : "Kronos";
          const accent = opt === "kira" ? "#D4E94B" : "#00E5FF";
          return (
            <button
              key={opt}
              role="radio"
              aria-checked={isActive}
              disabled={agentDisabled}
              onClick={() => onAgentChange(opt)}
              className={`
                relative h-8 px-3.5 rounded-full
                font-display text-[12.5px] font-medium
                transition-all duration-300
                disabled:opacity-50 disabled:cursor-not-allowed
                ${isActive ? "text-bg" : "text-text-muted hover:text-text"}
              `}
              style={{
                background: isActive ? accent : "transparent",
                boxShadow: isActive ? `0 0 12px ${accent}40, 0 0 0 1px ${accent}80` : "none",
                letterSpacing: "-0.012em",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Thinking level selector — only applies to Kira */}
      {agent === "kira" && (
        <div className="ml-2">
          <ThinkingLevelSelector
            value={thinkingLevel}
            onChange={onThinkingLevelChange}
            disabled={agentDisabled}
          />
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right side — touch targets >= 40px */}
      <div className="flex items-center gap-1.5">
        {/* New Chat button — círculo en mobile, pill con label en desktop */}
        <button
          onClick={onNewConversation}
          className="flex items-center justify-center gap-2 h-10 w-10 md:w-auto md:px-3 rounded-full text-sm font-medium transition-colors shrink-0"
          style={{
            backgroundColor: "var(--foreground)",
            color: "var(--background)",
          }}
          aria-label="Nueva conversación"
        >
          <Plus className="w-[18px] h-[18px]" />
          <span className="hidden md:inline font-display">Nuevo Chat</span>
        </button>

        {/* User avatar — touch wrapper 40x40 con avatar visual 32 */}
        <button
          onClick={() => onNavigate?.("settings")}
          aria-label="Ajustes de perfil"
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-opacity hover:opacity-80"
        >
          <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center bg-bg-elevated">
            {user.picture ? (
              <img src={user.picture} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-[12px] font-medium text-text">
                {user.name?.[0]?.toUpperCase() || "U"}
              </span>
            )}
          </div>
        </button>
      </div>
    </div>
  );
}
