import {
  Menu,
  PanelLeft,
  Bell,
  MessageSquarePlus,
  MoreVertical,
  FileText,
  Brain,
  Activity,
  Images,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { AgentToggle } from "@/components/shared/AgentToggle";
import { OnlineStatus } from "@/components/shared/OnlineStatus";
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

export function Header({
  agent,
  onAgentChange,
  agentDisabled,
  sidebarPinned,
  onToggleSidebar,
  onNewConversation,
  unreadCount,
  onOpenNotifications,
  onOpenBriefs,
  onOpenMemory,
  onOpenSystemStatus,
  onOpenGallery,
  onLogout,
}: Props) {
  return (
    <header className="flex items-center justify-between px-2 py-1.5 safe-top bg-bg/80 backdrop-blur-xl border-b border-border-subtle h-14 z-30">
      {/* Left: Sidebar toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleSidebar}
            className="text-text-muted hover:text-text"
          >
            {sidebarPinned ? <PanelLeft className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {sidebarPinned ? "Ocultar sidebar" : "Abrir sidebar"}
        </TooltipContent>
      </Tooltip>

      {/* Center: Agent toggle + online status */}
      <div className="flex flex-col items-center gap-0.5">
        <AgentToggle agent={agent} onChange={onAgentChange} disabled={agentDisabled} />
        <OnlineStatus />
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-0.5">
        {/* Notifications */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onOpenNotifications}
              className="relative text-text-muted hover:text-text"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 text-[10px] font-bold flex items-center justify-center"
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Badge>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Notificaciones</TooltipContent>
        </Tooltip>

        {/* New conversation */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onNewConversation}
              className="text-text-muted hover:text-text"
            >
              <MessageSquarePlus className="w-5 h-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Nueva conversación</TooltipContent>
        </Tooltip>

        {/* More menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="text-text-muted hover:text-text">
              <MoreVertical className="w-5 h-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={onOpenBriefs}>
              <FileText className="w-4 h-4 mr-2" />
              Briefs
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onOpenMemory}>
              <Brain className="w-4 h-4 mr-2" />
              Memoria
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onOpenSystemStatus}>
              <Activity className="w-4 h-4 mr-2" />
              Sistema
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onOpenGallery}>
              <Images className="w-4 h-4 mr-2" />
              Galería
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onLogout} className="text-danger focus:text-danger">
              <LogOut className="w-4 h-4 mr-2" />
              Cerrar Sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
