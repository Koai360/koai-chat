import { Menu, Edit3 } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";

interface TopBarProps {
  onMenu: () => void;
  onNewChat: () => void;
}

/**
 * TopBar — barra superior mínima para mobile.
 *
 * Desktop NO usa este componente — el sidebar tiene su propio header.
 * Mobile: ☰ menu izq + "Noa ⌄" centro-izq + ✎ new chat der.
 */
export function TopBar({ onMenu, onNewChat }: TopBarProps) {
  return (
    <header className="md:hidden flex items-center justify-between h-14 px-3 safe-top relative z-20">
      <IconButton
        icon={<Menu className="size-5" />}
        label="Abrir menú"
        variant="ghost"
        size="md"
        onClick={onMenu}
      />

      <div className="flex items-center gap-1.5 text-white">
        <span className="display text-[16px] font-semibold">Noa</span>
        <span className="mono text-white/40 text-[11px] tracking-tight uppercase">3.5 Flash</span>
      </div>

      <IconButton
        icon={<Edit3 className="size-[18px]" />}
        label="Nuevo chat"
        variant="ghost"
        size="md"
        onClick={onNewChat}
      />
    </header>
  );
}
