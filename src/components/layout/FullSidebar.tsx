import type { Conversation } from "@/hooks/useChat";
import type { AuthUser } from "@/hooks/useAuth";
import type { Page } from "@/hooks/useNavigation";
import { ConversationList } from "./ConversationList";
import { AIStarIcon } from "@/components/shared/AIStarIcon";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Home,
  MessageSquare,
  Compass,
  BookOpen,
  Image,
  ArrowUpCircle,
  ChevronDown,
  X,
} from "lucide-react";

interface Props {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename?: (id: string, newTitle: string) => void;
  onMoveToProject?: (conversationId: string, projectId: string | null) => void;
  onClose: () => void;
  user: AuthUser;
  onLogout: () => void;
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

const NAV_ITEMS: { page: Page; label: string; icon: React.ElementType }[] = [
  { page: "home", label: "Home", icon: Home },
  { page: "chatHistory", label: "Chat History", icon: MessageSquare },
  { page: "explore", label: "Explore", icon: Compass },
  { page: "explore", label: "Library", icon: BookOpen },
  { page: "media", label: "Media", icon: Image },
];

export function FullSidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onRename,
  onMoveToProject,
  onClose,
  user,
  onLogout: _onLogout,
  currentPage,
  onNavigate,
}: Props) {
  return (
    <div className="flex flex-col h-full w-full bg-bg-sidebar">
      {/* Header */}
      <div className="px-3 pt-3 pb-3 shrink-0 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-[var(--foreground)] rounded-full flex items-center justify-center">
              <AIStarIcon size="sm" className="w-4 h-4" />
            </div>
            <h2 className="text-[16px] font-medium text-text font-display">Kira</h2>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-text-muted hover:text-text" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Navigation items */}
        <div className="flex flex-col gap-0.5">
          {NAV_ITEMS.map((item, i) => {
            const Icon = item.icon;
            const isActive = currentPage === item.page;
            return (
              <button
                key={`${item.label}-${i}`}
                onClick={() => {
                  onNavigate(item.page);
                  onClose();
                }}
                className={`flex items-center gap-2.5 h-9 px-3 rounded-lg text-[13px] font-medium transition-colors ${
                  isActive
                    ? "bg-bg-surface text-text"
                    : "text-text-muted hover:text-text hover:bg-bg-surface/50"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Conversation list */}
      <ScrollArea className="flex-1">
        <ConversationList
          conversations={conversations}
          activeId={activeId}
          onSelect={(id) => {
            onSelect(id);
            onClose();
          }}
          onNew={() => {
            onNew();
            onClose();
          }}
          onDelete={onDelete}
          onRename={onRename}
          onMoveToProject={onMoveToProject}
        />
      </ScrollArea>

      {/* User footer */}
      <div
        className="px-3 pt-3 shrink-0 border-t border-border"
        style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
      >
        <button
          onClick={() => {
            onNavigate("settings");
            onClose();
          }}
          className="flex items-center gap-2.5 h-9 px-3 rounded-lg text-[13px] text-text-muted hover:text-text hover:bg-bg-surface/50 transition-colors w-full"
        >
          <ArrowUpCircle className="h-4 w-4 shrink-0" />
          Upgrade Plan
        </button>

        <div className="flex items-center gap-2 mt-2 px-1">
          <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 overflow-hidden bg-bg-surface">
            {user.picture ? (
              <img src={user.picture} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-[11px] font-medium text-text">
                {user.name?.[0]?.toUpperCase() || "U"}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] text-text truncate">{user.name || "User"}</p>
            <p className="text-[10px] text-text-muted truncate">{user.email || ""}</p>
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-text-muted shrink-0" />
        </div>
      </div>
    </div>
  );
}
