import { Menu, Edit3 } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { ModelPicker } from "@/components/chat/ModelPicker";
import type { ModelMode } from "@/lib/autoThinking";

interface TopBarProps {
  onMenu: () => void;
  onNewChat: () => void;
  modelMode: ModelMode;
  onModelModeChange: (mode: ModelMode) => void;
}

/**
 * TopBar — barra superior mínima para mobile.
 *
 * Desktop NO usa este componente — el sidebar tiene su propio header.
 * Mobile: ☰ menu izq · ModelPicker centro · ✎ new chat der.
 *
 * Touch targets HIG iOS: 44×44 mínimo en los IconButtons.
 */
export function TopBar({ onMenu, onNewChat, modelMode, onModelModeChange }: TopBarProps) {
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

      <ModelPicker mode={modelMode} onChange={onModelModeChange} />

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
