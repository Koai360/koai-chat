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
      className="flex items-center px-4 shrink-0 liquid-glass border-b border-white/[0.04]"
      style={{ height: "calc(56px + env(safe-area-inset-top, 0px))", paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      {/* Center-left — model selector pill */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={agentDisabled}>
          <button
            className="flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors"
            style={{
              borderColor: agent === 'kronos' ? 'rgba(0,229,255,0.4)' : 'rgba(123, 45, 142, 0.4)',
              background: agent === 'kronos' ? 'rgba(0,229,255,0.08)' : 'rgba(123, 45, 142, 0.25)',
            }}
          >
            <AIStarIcon size="sm" className="w-4 h-4" />
            <span className="text-sm font-medium text-white/90 font-display">
              {AGENT_LABELS[agent]}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
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

      {/* Right side */}
      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-text-muted hover:text-text"
          onClick={onToggleTheme}
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </Button>

        {/* New Chat button */}
        <button
          onClick={onNewConversation}
          className="flex items-center gap-2 h-9 px-3 rounded-full text-sm font-medium transition-colors"
          style={{
            backgroundColor: "var(--foreground)",
            color: "var(--background)",
          }}
        >
          <Plus className="w-4 h-4" />
          <span className="hidden md:inline font-display">Nuevo Chat</span>
        </button>

        {/* User avatar */}
        <button
          onClick={() => onNavigate?.("settings")}
          aria-label="Ajustes de perfil"
          className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center bg-bg-elevated shrink-0 transition-opacity hover:opacity-80">
          {user.picture ? (
            <img src={user.picture} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-[11px] font-medium text-text">
              {user.name?.[0]?.toUpperCase() || "U"}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
