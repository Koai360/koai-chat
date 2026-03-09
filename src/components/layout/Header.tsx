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
    <header className="flex items-center justify-between px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 bg-bg/80 backdrop-blur-xl border-b border-border-subtle z-30 shrink-0">
      {/* Left: Sidebar toggle */}
      <div className="w-10">
        {!sidebarPinned && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleSidebar}
                className="text-text-muted hover:text-text"
              >
                <Menu className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Abrir sidebar</TooltipContent>
          </Tooltip>
        )}
        {sidebarPinned && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleSidebar}
                className="text-text-muted hover:text-text"
              >
                <PanelLeft className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Ocultar sidebar</TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Center: Agent toggle only */}
      <AgentToggle agent={agent} onChange={onAgentChange} disabled={agentDisabled} />

      {/* Right: Actions */}
      <div className="flex items-center gap-0.5">
        {/* Notifications — always visible */}
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

        {/* New conversation — visible on desktop */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onNewConversation}
              className="hidden md:flex text-text-muted hover:text-text"
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
            <DropdownMenuItem onClick={onNewConversation} className="md:hidden">
              <MessageSquarePlus className="w-4 h-4 mr-2" />
              Nueva conversación
            </DropdownMenuItem>
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
