import { Menu, Edit3 } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { ModelPicker } from "@/components/chat/ModelPicker";
import type { ThinkingLevel } from "@/types/api";

interface TopBarProps {
  onMenu: () => void;
  onNewChat: () => void;
  thinkingLevel: ThinkingLevel;
  onThinkingLevelChange: (lvl: ThinkingLevel) => void;
}

/**
 * TopBar — barra superior mínima para mobile.
 *
 * Desktop NO usa este componente — el sidebar tiene su propio header.
 * Mobile: ☰ menu izq · ModelPicker centro · ✎ new chat der.
 *
 * Touch targets HIG iOS: 44×44 mínimo en los IconButtons.
 */
export function TopBar({ onMenu, onNewChat, thinkingLevel, onThinkingLevelChange }: TopBarProps) {
  return (
    <header
      className="md:hidden flex items-center justify-between min-h-[64px] px-2 pb-2 relative z-20"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.5rem)" }}
    >
      <IconButton
        icon={<Menu className="size-[22px]" strokeWidth={2} />}
        label="Abrir menú"
        variant="ghost"
        size="lg"
        onClick={onMenu}
      />

      <ModelPicker level={thinkingLevel} onChange={onThinkingLevelChange} />

      <IconButton
        icon={<Edit3 className="size-[20px]" strokeWidth={2} />}
        label="Nuevo chat"
        variant="ghost"
        size="lg"
        onClick={onNewChat}
      />
    </header>
  );
}
