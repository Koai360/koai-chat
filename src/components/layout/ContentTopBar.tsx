import { Plus, Bell } from "lucide-react";
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
  currentPage: Page;
  user: AuthUser;
  // Mantenemos las props por compatibilidad pero ya no se usan visualmente
  theme?: "dark" | "light";
  onToggleTheme?: () => void;
  onNavigate?: (page: Page) => void;
  /** Campana de notificaciones: unread count + handler de apertura */
  unreadCount?: number;
  onOpenNotifications?: () => void;
  /** ADK memory usage ratio (0.0-1.0) — solo visible en chat view y cuando >=0.6 */
  memoryUsage?: number;
}

/**
 * ContentTopBar — barra superior con:
 * - Toggle Noa ↔ Kronos (segmented control, no dropdown)
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
  currentPage,
  user,
  onNavigate,
  unreadCount = 0,
  onOpenNotifications,
  memoryUsage = 0,
}: Props) {
  // El botón "+" de nuevo chat solo tiene sentido fuera de home
  // (home YA es un chat vacío conceptualmente — crear convo desde ahí
  // pasa automáticamente al escribir o tocar un quick action)
  const showNewChatButton = currentPage !== "home";
  return (
    <div
      className="flex items-center px-3 sm:px-4 shrink-0 bg-bg gap-2 topbar-chrome"
      style={{
        paddingTop: "env(safe-area-inset-top, 0px)",
      }}
    >
      {/* Toggle Noa ↔ Kronos — segmented control */}
      <div
        role="radiogroup"
        aria-label="Seleccionar agente"
        className="inline-flex items-center h-9 sm:h-10 p-1 rounded-full border border-border bg-bg-surface"
      >
        {(["noa", "kronos"] as const).map((opt) => {
          const isActive = agent === opt;
          const label = opt === "noa" ? "Noa" : "Kronos";
          const accent = opt === "noa" ? "#D4E94B" : "#00E5FF";
          return (
            <button
              key={opt}
              role="radio"
              aria-checked={isActive}
              disabled={agentDisabled}
              onClick={() => onAgentChange(opt)}
              className={`
                relative h-7 sm:h-8 px-3 sm:px-3.5 rounded-full
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

      {/* Thinking level selector — only applies to Noa */}
      {agent === "noa" && (
        <div className="ml-2">
          <ThinkingLevelSelector
            value={thinkingLevel}
            onChange={onThinkingLevelChange}
            disabled={agentDisabled}
          />
        </div>
      )}

      {/* Memory / contexto usado — chip al lado del thinking. Solo visible en chat
          view y cuando >=60% (para evitar ruido). Agrupa "estado del agente" en un
          solo lugar en vez de colgar debajo del input. */}
      {currentPage === "chat" && memoryUsage >= 0.6 && (
        <div
          className="ml-1.5 hidden sm:flex items-center gap-1.5 h-7 sm:h-8 px-2 rounded-full text-[11px] font-medium"
          style={{
            backgroundColor: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)",
            color: memoryUsage >= 0.85 ? "#ef4444" : "#f59e0b",
          }}
          title="Contexto usado en esta conversación. Al llenarse, la memoria se reinicia automáticamente."
        >
          <svg width="12" height="12" viewBox="0 0 16 16" className="shrink-0">
            <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.5" />
            <circle
              cx="8" cy="8" r="6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeDasharray={`${memoryUsage * 37.7} 37.7`}
              transform="rotate(-90 8 8)"
            />
          </svg>
          <span className="leading-none tabular-nums">
            {memoryUsage >= 0.85 ? "casi llena" : `${Math.round(memoryUsage * 100)}%`}
          </span>
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right side — touch targets 40px mobile, idem desktop */}
      <div className="flex items-center gap-1">
        {/* Campana de notificaciones con badge de unread */}
        {onOpenNotifications && (
          <button
            onClick={onOpenNotifications}
            aria-label={unreadCount > 0 ? `${unreadCount} notificaciones sin leer` : "Notificaciones"}
            className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0 text-text-muted hover:text-text transition-colors"
          >
            <Bell className="w-[18px] h-[18px]" />
            {unreadCount > 0 && (
              <span
                className="absolute top-1 right-1 min-w-[16px] h-[16px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center"
                style={{
                  backgroundColor: "#D4E94B",
                  color: "#0a0a0c",
                }}
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
        )}

        {/* New Chat button — oculto en home (home ya es un chat vacío) */}
        {showNewChatButton && (
          <button
            onClick={onNewConversation}
            className="flex items-center justify-center gap-2 h-9 sm:h-10 w-9 sm:w-10 md:w-auto md:px-3 rounded-full text-sm font-medium transition-colors shrink-0"
            style={{
              backgroundColor: "var(--foreground)",
              color: "var(--background)",
            }}
            aria-label="Nueva conversación"
          >
            <Plus className="w-[18px] h-[18px]" />
            <span className="hidden md:inline font-display">Nuevo Chat</span>
          </button>
        )}

        {/* User avatar — touch wrapper compacto mobile, 40 desktop */}
        <button
          onClick={() => onNavigate?.("settings")}
          aria-label="Ajustes de perfil"
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0 transition-opacity hover:opacity-80"
        >
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden flex items-center justify-center bg-bg-elevated">
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
