import { Menu, Plus } from "lucide-react";
import type { Agent } from "@/hooks/useChat";

interface Props {
  agent: Agent;
  onAgentChange: (agent: Agent) => void;
  agentDisabled: boolean;
  sidebarPinned: boolean;
  onToggleSidebar: () => void;
  onNewConversation: () => void;
  unreadCount: number;
  onOpenNotifications: () => void;
  onOpenBriefs: () => void;
  onOpenMemory: () => void;
  onOpenSystemStatus: () => void;
  onOpenGallery: () => void;
  onLogout: () => void;
}

const AGENT_COLORS = {
  kira:   { lime: "var(--color-kira)",   bg: "var(--color-bg)" },
  kronos: { lime: "var(--color-kronos)", bg: "var(--color-bg)" },
};

export function Header({
  agent,
  onAgentChange,
  agentDisabled,
  onToggleSidebar,
  onNewConversation,
}: Props) {
  const colors = AGENT_COLORS[agent];

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-40 backdrop-blur-xl transition-colors duration-300"
      style={{
        backgroundColor: `color-mix(in srgb, ${colors.bg} 80%, transparent)`,
        borderBottom: `1px solid var(--color-border)`,
        paddingTop: "env(safe-area-inset-top)",
      }}
    >
      <div className="flex items-center justify-between h-[56px] px-4">
        {/* Menu button */}
        <button
          onClick={onToggleSidebar}
          className="w-10 h-10 flex items-center justify-center rounded-xl active:bg-white/5 transition-colors"
        >
          <Menu className="w-5 h-5" style={{ color: colors.lime }} />
        </button>

        {/* Model Selector — Center */}
        <div className="relative flex-1 flex justify-center">
          <div
            className="flex items-center gap-1 p-1 rounded-full transition-all duration-300"
            style={{
              backgroundColor: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            <button
              onClick={() => !agentDisabled && onAgentChange("kira")}
              disabled={agentDisabled}
              className="px-4 py-1.5 rounded-full text-[14px] font-medium transition-all duration-200 disabled:opacity-50"
              style={{
                backgroundColor: agent === "kira" ? "var(--color-kira)" : "transparent",
                color: agent === "kira" ? "#000000" : "rgba(255,255,255,0.55)",
              }}
            >
              Kira
            </button>
            <button
              onClick={() => !agentDisabled && onAgentChange("kronos")}
              disabled={agentDisabled}
              className="px-4 py-1.5 rounded-full text-[14px] font-medium transition-all duration-200 disabled:opacity-50"
              style={{
                backgroundColor: agent === "kronos" ? "var(--color-kronos)" : "transparent",
                color: agent === "kronos" ? "#000000" : "rgba(255,255,255,0.55)",
              }}
            >
              Kronos
            </button>
          </div>
        </div>

        {/* New Chat */}
        <button
          onClick={onNewConversation}
          className="w-10 h-10 flex items-center justify-center rounded-xl active:bg-white/5 transition-colors"
        >
          <Plus className="w-5 h-5" style={{ color: colors.lime }} />
        </button>
      </div>
    </nav>
  );
}
