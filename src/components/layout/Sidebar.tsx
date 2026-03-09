import { useState, useCallback, useRef, useEffect } from "react";
import type { Conversation } from "@/hooks/useChat";
import type { AuthUser } from "@/hooks/useAuth";
import { relativeTime } from "@/lib/time";
import {
  fetchProjects,
  createProject,
  type ServerProject,
} from "@/lib/api";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";


import {
  Plus,
  Search,
  MessageSquare,
  Trash2,
  X,
  MoreHorizontal,
  FolderOpen,
  FolderPlus,
  LogOut,
  Hash,
} from "lucide-react";

interface Props {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onMoveToProject?: (conversationId: string, projectId: string | null) => void;
  onClose: () => void;
  user: AuthUser;
  onLogout: () => void;
}

function haptic(ms = 8) {
  if (navigator.vibrate) navigator.vibrate(ms);
}

function groupByTime(conversations: Conversation[]) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);
  const monthAgo = new Date(today.getTime() - 30 * 86400000);

  const groups: { label: string; items: Conversation[] }[] = [
    { label: "Hoy", items: [] },
    { label: "Ayer", items: [] },
    { label: "Últimos 7 días", items: [] },
    { label: "Últimos 30 días", items: [] },
    { label: "Anteriores", items: [] },
  ];

  for (const c of conversations) {
    const d = new Date(c.createdAt);
    if (d >= today) groups[0].items.push(c);
    else if (d >= yesterday) groups[1].items.push(c);
    else if (d >= weekAgo) groups[2].items.push(c);
    else if (d >= monthAgo) groups[3].items.push(c);
    else groups[4].items.push(c);
  }

  return groups.filter((g) => g.items.length > 0);
}

export function Sidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onMoveToProject,
  onClose,
  user,
  onLogout,
}: Props) {
  const [search, setSearch] = useState("");
  const [projects, setProjects] = useState<ServerProject[]>([]);
  const [activeProject, setActiveProject] = useState<string | null>(null);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [moveDialogId, setMoveDialogId] = useState<string | null>(null);

  // Swipe-to-delete
  const swipingRef = useRef<{ id: string; startX: number; currentX: number } | null>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [swipedId, setSwipedId] = useState<string | null>(null);

  useEffect(() => {
    fetchProjects().then(setProjects).catch(() => {});
  }, []);

  const filtered = conversations.filter((c) => {
    if (search) {
      const q = search.toLowerCase();
      const title = (c.title || "").toLowerCase();
      const lastMsg = c.messages[c.messages.length - 1]?.content?.toLowerCase() || "";
      if (!title.includes(q) && !lastMsg.includes(q)) return false;
    }
    if (activeProject) {
      return c.projectId === activeProject;
    }
    return true;
  });

  const groups = groupByTime(filtered);

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    try {
      const p = await createProject(newProjectName.trim());
      setProjects((prev) => [...prev, p]);
      setNewProjectName("");
      setShowNewProject(false);
    } catch {}
  };

  const handleTouchStart = useCallback((id: string, e: React.TouchEvent) => {
    if (swipedId && swipedId !== id) {
      const prev = itemRefs.current.get(swipedId);
      if (prev) {
        prev.style.transition = "transform 0.15s";
        prev.style.transform = "";
        setTimeout(() => { if (prev) prev.style.transition = ""; }, 150);
      }
      setSwipedId(null);
    }
    swipingRef.current = { id, startX: e.touches[0].clientX, currentX: 0 };
  }, [swipedId]);

  const handleTouchMove = useCallback((id: string, e: React.TouchEvent) => {
    if (!swipingRef.current || swipingRef.current.id !== id) return;
    const diff = swipingRef.current.startX - e.touches[0].clientX;
    if (diff > 0) {
      swipingRef.current.currentX = diff;
      const el = itemRefs.current.get(id);
      if (el) el.style.transform = `translateX(-${Math.min(diff, 80)}px)`;
    }
  }, []);

  const handleTouchEnd = useCallback((id: string) => {
    if (!swipingRef.current || swipingRef.current.id !== id) return;
    const el = itemRefs.current.get(id);
    if (swipingRef.current.currentX > 60) {
      if (el) {
        el.style.transition = "transform 0.15s";
        el.style.transform = "translateX(-80px)";
        setTimeout(() => { if (el) el.style.transition = ""; }, 150);
      }
      haptic();
      setSwipedId(id);
    } else {
      if (el) {
        el.style.transition = "transform 0.15s";
        el.style.transform = "";
        setTimeout(() => { if (el) el.style.transition = ""; }, 150);
      }
    }
    swipingRef.current = null;
  }, []);

  const handleSwipeDelete = useCallback((id: string) => {
    const el = itemRefs.current.get(id);
    if (el) {
      el.style.transition = "transform 0.2s, opacity 0.2s";
      el.style.transform = "translateX(-100%)";
      el.style.opacity = "0";
    }
    haptic(15);
    setTimeout(() => { onDelete(id); setSwipedId(null); }, 200);
  }, [onDelete]);

  return (
    <div className="flex flex-col h-full bg-bg-sidebar w-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 safe-top shrink-0">
        <div className="flex items-center gap-2">
          <img src="/icons/kira-logo.svg" alt="KOAI" className="w-8 h-8 rounded-lg" />
          <span className="font-semibold text-sm text-text">KOAI Chat</span>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-text-muted" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* New Chat button */}
      <div className="px-3 pb-2 shrink-0">
        <Button
          onClick={onNew}
          className="w-full justify-start gap-2 bg-brand/10 hover:bg-brand/20 text-brand border-0 h-9"
          variant="outline"
        >
          <Plus className="h-4 w-4" />
          <span className="text-sm font-medium">Nuevo Chat</span>
        </Button>
      </div>

      {/* Search */}
      <div className="px-3 pb-2 shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar..."
            className="pl-8 h-8 text-xs bg-bg-surface border-border-subtle"
          />
        </div>
      </div>

      {/* Projects row */}
      {projects.length > 0 && (
        <div className="px-3 pb-2 flex gap-1 overflow-x-auto no-scrollbar shrink-0">
          <Button
            variant={activeProject === null ? "default" : "ghost"}
            size="sm"
            className="h-6 text-[10px] px-2 shrink-0"
            onClick={() => setActiveProject(null)}
          >
            Todos
          </Button>
          {projects.map((p) => (
            <Button
              key={p.id}
              variant={activeProject === p.id ? "default" : "ghost"}
              size="sm"
              className="h-6 text-[10px] px-2 shrink-0 gap-1"
              onClick={() => setActiveProject(activeProject === p.id ? null : p.id)}
            >
              <Hash className="h-2.5 w-2.5" />
              {p.name}
            </Button>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] px-2 shrink-0 text-text-muted"
            onClick={() => setShowNewProject(true)}
          >
            <FolderPlus className="h-2.5 w-2.5" />
          </Button>
        </div>
      )}

      <Separator className="bg-border-subtle" />

      {/* Conversation list */}
      <ScrollArea className="flex-1">
        <div className="py-1">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-6">
              <MessageSquare className="h-10 w-10 text-text-muted/30 mb-3" />
              <p className="text-xs text-text-muted">
                {search ? "Sin resultados" : "No hay conversaciones"}
              </p>
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.label}>
                <p className="px-3 py-1.5 text-[10px] font-medium text-text-muted uppercase tracking-wider">
                  {group.label}
                </p>
                {group.items.map((convo) => {
                  const isActive = convo.id === activeId;
                  const lastMsg = convo.messages[convo.messages.length - 1];
                  const preview = lastMsg?.content?.slice(0, 50) || "";
                  const title = convo.title || preview || "Nuevo chat";

                  return (
                    <div key={convo.id} className="relative overflow-hidden mx-1 mb-0.5">
                      {/* Delete background */}
                      <div className="absolute inset-y-0 right-0 w-20 bg-destructive flex items-center justify-center rounded-r-lg">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleSwipeDelete(convo.id); }}
                          className="w-full h-full flex items-center justify-center"
                        >
                          <Trash2 className="h-4 w-4 text-white" />
                        </button>
                      </div>

                      {/* Item */}
                      <div
                        ref={(el) => {
                          if (el) itemRefs.current.set(convo.id, el);
                          else itemRefs.current.delete(convo.id);
                        }}
                        onTouchStart={(e) => handleTouchStart(convo.id, e)}
                        onTouchMove={(e) => handleTouchMove(convo.id, e)}
                        onTouchEnd={() => handleTouchEnd(convo.id)}
                        onClick={() => {
                          if (swipedId === convo.id) {
                            const el = itemRefs.current.get(convo.id);
                            if (el) {
                              el.style.transition = "transform 0.15s";
                              el.style.transform = "";
                            }
                            setSwipedId(null);
                            return;
                          }
                          onSelect(convo.id);
                        }}
                        className={`relative flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer transition-colors bg-bg-sidebar ${
                          isActive
                            ? "bg-brand/10 border border-brand/20"
                            : "hover:bg-bg-surface active:bg-bg-surface"
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm truncate ${isActive ? "text-text font-medium" : "text-text"}`}>
                            {title}
                          </p>
                          {preview && !convo.title && (
                            <p className="text-[11px] text-text-muted truncate mt-0.5">{preview}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] text-text-muted">
                            {relativeTime(convo.createdAt)}
                          </span>
                          {onMoveToProject && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                <button className="w-6 h-6 flex items-center justify-center rounded text-text-muted hover:text-text opacity-0 group-hover:opacity-100">
                                  <MoreHorizontal className="h-3.5 w-3.5" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem onClick={() => setMoveDialogId(convo.id)}>
                                  <FolderOpen className="h-3.5 w-3.5 mr-2" />
                                  Mover a proyecto
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => onDelete(convo.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5 mr-2" />
                                  Eliminar
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* User footer */}
      <Separator className="bg-border-subtle" />
      <div className="px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          {user.picture ? (
            <img src={user.picture} alt="" className="w-7 h-7 rounded-full" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-brand/20 flex items-center justify-center text-xs font-medium text-brand">
              {user.name?.[0]?.toUpperCase() || "U"}
            </div>
          )}
          <span className="text-xs text-text-muted truncate">{user.name || user.email}</span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-text-muted" onClick={onLogout}>
          <LogOut className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Move to project dialog */}
      <Dialog open={moveDialogId !== null} onOpenChange={(open) => !open && setMoveDialogId(null)}>
        <DialogContent className="max-w-[320px]">
          <DialogHeader>
            <DialogTitle className="text-sm">Mover a proyecto</DialogTitle>
          </DialogHeader>
          <div className="space-y-1">
            <Button
              variant="ghost"
              className="w-full justify-start text-sm h-9"
              onClick={() => {
                if (moveDialogId) onMoveToProject?.(moveDialogId, null);
                setMoveDialogId(null);
              }}
            >
              Sin proyecto
            </Button>
            {projects.map((p) => (
              <Button
                key={p.id}
                variant="ghost"
                className="w-full justify-start text-sm h-9 gap-2"
                onClick={() => {
                  if (moveDialogId) onMoveToProject?.(moveDialogId, p.id);
                  setMoveDialogId(null);
                }}
              >
                <Hash className="h-3.5 w-3.5" />
                {p.name}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* New project dialog */}
      <Dialog open={showNewProject} onOpenChange={setShowNewProject}>
        <DialogContent className="max-w-[320px]">
          <DialogHeader>
            <DialogTitle className="text-sm">Nuevo proyecto</DialogTitle>
          </DialogHeader>
          <Input
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            placeholder="Nombre del proyecto"
            className="text-sm"
            onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
          />
          <Button onClick={handleCreateProject} disabled={!newProjectName.trim()} className="w-full">
            Crear
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
