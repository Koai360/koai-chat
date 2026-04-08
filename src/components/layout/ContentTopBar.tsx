import { Sun, Moon, Plus, ChevronDown } from "lucide-react";
import type { Agent } from "@/hooks/useChat";
import type { AuthUser } from "@/hooks/useAuth";
import type { Page } from "@/hooks/useNavigation";
import { AIStarIcon } from "@/components/shared/AIStarIcon";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  agent: Agent;
  onAgentChange: (agent: Agent) => void;
  agentDisabled: boolean;
  onNewConversation: () => void;
  user: AuthUser;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onNavigate?: (page: Page) => void;
}

const AGENT_LABELS: Record<Agent, string> = {
  kira: "Kira 1.0",
  kronos: "Kronos 1.0",
};

export function ContentTopBar({
  agent,
  onAgentChange,
  agentDisabled,
  onNewConversation,
  user,
  theme,
  onToggleTheme,
  onNavigate,
}: Props) {
  return (
    <div
      className="flex items-center px-3 sm:px-4 shrink-0 bg-bg gap-2"
      style={{
        // Safe area como padding-top, height fijo de 56px (no se suma)
        paddingTop: "env(safe-area-inset-top, 0px)",
        minHeight: "calc(56px + env(safe-area-inset-top, 0px))",
      }}
    >
      {/* Model selector pill — más alto en mobile para touch */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={agentDisabled}>
          <button
            className="flex items-center gap-2 h-10 px-3 rounded-full border transition-colors min-w-0"
            style={{
              borderColor: agent === 'kronos' ? 'rgba(0,229,255,0.4)' : 'rgba(123, 45, 142, 0.4)',
              background: agent === 'kronos' ? 'rgba(0,229,255,0.08)' : 'rgba(123, 45, 142, 0.25)',
            }}
            aria-label={`Cambiar agente. Actual: ${AGENT_LABELS[agent]}`}
          >
            <AIStarIcon size="sm" className="w-4 h-4 shrink-0" />
            <span className="text-[13px] font-medium text-white/90 font-display truncate">
              {AGENT_LABELS[agent]}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-text-muted shrink-0" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          <DropdownMenuItem onClick={() => onAgentChange("kira")}>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-kira" />
              <span>Kira 1.0</span>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAgentChange("kronos")}>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-kronos" />
              <span>Kronos 1.0</span>
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right side — touch targets ≥ 40px */}
      <div className="flex items-center gap-1.5">
        {/* Theme toggle — 40px mobile, 36px desktop */}
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 sm:h-9 sm:w-9 text-text-muted hover:text-text shrink-0"
          onClick={onToggleTheme}
          aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
        >
          {theme === "dark" ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
        </Button>

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

        {/* User avatar — 36px touch target (boton wrapper de 40x40 con avatar 32 dentro) */}
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
