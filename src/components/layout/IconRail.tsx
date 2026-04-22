import {
  House,
  MessageSquare,
  Compass,
  Image as ImageIcon,
  Brain,
  BookOpen,
} from "lucide-react";
import type { Page } from "@/hooks/useNavigation";
import type { AuthUser } from "@/hooks/useAuth";
import type { Agent } from "@/hooks/useChat";
import { AIStarIcon } from "@/components/shared/AIStarIcon";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Settings, LogOut } from "lucide-react";

interface Props {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  user: AuthUser;
  onLogout: () => void;
  agent?: Agent;
}

const NAV_ITEMS: { page: Page; icon: typeof House; label: string }[] = [
  { page: "home", icon: House, label: "Inicio" },
  { page: "chatHistory", icon: MessageSquare, label: "Chat" },
  { page: "explore", icon: Compass, label: "Explorar" },
  { page: "media", icon: ImageIcon, label: "Galería" },
  { page: "memory", icon: Brain, label: "Memoria" },
  { page: "kb", icon: BookOpen, label: "KB Manager" },
];

export function IconRail({ currentPage, onNavigate, user, onLogout, agent = "noa" }: Props) {
  const accentColor = agent === "kronos" ? "#00E5FF" : "#D4E94B";

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className="hidden md:flex flex-col items-center w-14 h-full liquid-glass shrink-0"
        style={{ "--accent-color": accentColor } as React.CSSProperties}
      >
        {/* Logo */}
        <div className="flex items-center justify-center h-14 shrink-0">
          <div className="w-8 h-8 rounded-full bg-bg-elevated flex items-center justify-center">
            <AIStarIcon size="sm" />
          </div>
        </div>

        {/* Nav icons */}
        <nav className="flex flex-col items-center gap-1 mt-2 flex-1">
          {NAV_ITEMS.map((item, i) => {
            const Icon = item.icon;
            const isActive = currentPage === item.page;
            return (
              <Tooltip key={`${item.label}-${i}`}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onNavigate(item.page)}
                    aria-label={item.label}
                    className={`icon-rail-item ${isActive ? "active" : ""}`}
                  >
                    <Icon className="w-5 h-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </nav>

        {/* Bottom — user avatar */}
        <div className="pb-3 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center bg-bg-elevated hover:ring-2 hover:ring-border transition-all">
                {user.picture ? (
                  <img src={user.picture} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs font-medium text-text">
                    {user.name?.[0]?.toUpperCase() || "U"}
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="end" sideOffset={8} className="w-44">
              <DropdownMenuItem onClick={() => onNavigate("settings")}>
                <Settings className="h-4 w-4 mr-2" />
                Configuración
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={onLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </TooltipProvider>
  );
}
