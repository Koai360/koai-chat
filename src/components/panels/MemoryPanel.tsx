import { useState, useEffect } from "react";
import type { KronosMemory, UserMemory } from "@/lib/api";
import {
  fetchMemories, createMemory, deleteMemory,
  fetchUserMemories, createUserMemory, deleteUserMemory,
} from "@/lib/api";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, X, Plus, Trash2, AlertCircle, Lightbulb, Info, Star, User, Cpu } from "lucide-react";

interface Props {
  onClose: () => void;
}

// ─── Kronos memory types ─────────────────────────────────────────────────────
type KronosFilter = "all" | "decision" | "context" | "preference";

const KRONOS_TYPE_CONFIG: Record<string, { icon: typeof Brain; color: string }> = {
  decision: { icon: Lightbulb, color: "text-yellow-400" },
  context: { icon: Info, color: "text-blue-400" },
  preference: { icon: Star, color: "text-kira" },
};

// ─── User memory types ──────────────────────────────────────────────────────
type UserFilter = "all" | "preference" | "context" | "fact" | "instruction";

const USER_TYPE_CONFIG: Record<string, { icon: typeof Brain; color: string; label: string }> = {
  preference: { icon: Star, color: "text-kira", label: "Preferencia" },
  context: { icon: Info, color: "text-blue-400", label: "Contexto" },
  fact: { icon: Lightbulb, color: "text-yellow-400", label: "Dato" },
  instruction: { icon: AlertCircle, color: "text-orange-400", label: "Instrucción" },
};

type TabKey = "kronos" | "user";

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Ahora";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString("es", { day: "numeric", month: "short" });
}

export function MemoryPanel({ onClose }: Props) {
  const [tab, setTab] = useState<TabKey>("user");

  // ─── Kronos state ─────────────────────────────────────────────────────────
  const [kronosMemories, setKronosMemories] = useState<KronosMemory[]>([]);
  const [kronosLoading, setKronosLoading] = useState(false);
  const [kronosError, setKronosError] = useState("");
  const [kronosFilter, setKronosFilter] = useState<KronosFilter>("all");
  const [showKronosCreate, setShowKronosCreate] = useState(false);
  const [kronosFormType, setKronosFormType] = useState("decision");
  const [kronosFormTitle, setKronosFormTitle] = useState("");
  const [kronosFormContent, setKronosFormContent] = useState("");
  const [kronosSaving, setKronosSaving] = useState(false);

  // ─── User state ───────────────────────────────────────────────────────────
  const [userMemories, setUserMemories] = useState<UserMemory[]>([]);
  const [userLoading, setUserLoading] = useState(false);
  const [userError, setUserError] = useState("");
  const [userFilter, setUserFilter] = useState<UserFilter>("all");
  const [showUserCreate, setShowUserCreate] = useState(false);
  const [userFormType, setUserFormType] = useState("context");
  const [userFormContent, setUserFormContent] = useState("");
  const [userSaving, setUserSaving] = useState(false);

  // ─── Loaders ──────────────────────────────────────────────────────────────
  const loadKronos = () => {
    setKronosLoading(true);
    setKronosError("");
    fetchMemories(kronosFilter === "all" ? undefined : kronosFilter)
      .then(setKronosMemories)
      .catch((e) => setKronosError(e.message))
      .finally(() => setKronosLoading(false));
  };

  const loadUser = () => {
    setUserLoading(true);
    setUserError("");
    fetchUserMemories(userFilter === "all" ? undefined : userFilter)
      .then(setUserMemories)
      .catch((e) => setUserError(e.message))
      .finally(() => setUserLoading(false));
  };

  useEffect(() => {
    if (tab === "kronos") loadKronos();
  }, [tab, kronosFilter]);

  useEffect(() => {
    if (tab === "user") loadUser();
  }, [tab, userFilter]);

  // ─── Kronos CRUD ──────────────────────────────────────────────────────────
  const handleKronosCreate = async () => {
    if (!kronosFormTitle.trim() || !kronosFormContent.trim()) return;
    setKronosSaving(true);
    try {
      await createMemory({ type: kronosFormType, title: kronosFormTitle.trim(), content: kronosFormContent.trim() });
      setKronosFormTitle("");
      setKronosFormContent("");
      setShowKronosCreate(false);
      loadKronos();
    } catch (e: unknown) {
      setKronosError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setKronosSaving(false);
    }
  };

  const handleKronosDelete = async (id: string) => {
    try {
      await deleteMemory(id);
      setKronosMemories((prev) => prev.filter((m) => m.id !== id));
    } catch (e: unknown) {
      setKronosError(e instanceof Error ? e.message : "Error al eliminar");
    }
  };

  // ─── User CRUD ────────────────────────────────────────────────────────────
  const handleUserCreate = async () => {
    if (!userFormContent.trim()) return;
    setUserSaving(true);
    try {
      await createUserMemory({ type: userFormType, content: userFormContent.trim() });
      setUserFormContent("");
      setShowUserCreate(false);
      loadUser();
    } catch (e: unknown) {
      setUserError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setUserSaving(false);
    }
  };

  const handleUserDelete = async (id: string) => {
    try {
      await deleteUserMemory(id);
      setUserMemories((prev) => prev.filter((m) => m.id !== id));
    } catch (e: unknown) {
      setUserError(e instanceof Error ? e.message : "Error al eliminar");
    }
  };

  // ─── Shared components ────────────────────────────────────────────────────
  const renderLoading = () => (
    <div className="px-4 py-4 space-y-3">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-full" />
        </div>
      ))}
    </div>
  );

  const renderError = (msg: string) => (
    <div className="flex flex-col items-center justify-center h-32 px-8 text-center">
      <AlertCircle className="h-8 w-8 text-destructive/50 mb-2" />
      <p className="text-sm text-destructive">{msg}</p>
    </div>
  );

  const renderEmpty = (label: string) => (
    <div className="flex flex-col items-center justify-center h-32 px-8 text-center">
      <Brain className="h-10 w-10 text-text-muted/30 mb-3" />
      <p className="text-sm text-text-muted">{label}</p>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle safe-top">
        <h2 className="text-base font-semibold text-text">Memoria</h2>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[11px] text-kira"
            onClick={() => tab === "kronos" ? setShowKronosCreate(true) : setShowUserCreate(true)}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Nueva
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-text-muted" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main tabs: Kronos / Sobre mí */}
      <div className="flex border-b border-border-subtle">
        <button
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
            tab === "user" ? "text-kira border-b-2 border-kira" : "text-text-muted hover:text-text"
          }`}
          onClick={() => setTab("user")}
        >
          <User className="h-3.5 w-3.5" />
          Sobre mí
        </button>
        <button
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
            tab === "kronos" ? "text-kira border-b-2 border-kira" : "text-text-muted hover:text-text"
          }`}
          onClick={() => setTab("kronos")}
        >
          <Cpu className="h-3.5 w-3.5" />
          Kronos
        </button>
      </div>

      {/* ═══ TAB: Sobre mí ═══ */}
      {tab === "user" && (
        <>
          {/* User filter */}
          <div className="flex gap-1 px-4 py-2 border-b border-border-subtle overflow-x-auto">
            {(["all", "fact", "context", "preference", "instruction"] as UserFilter[]).map((key) => (
              <Button
                key={key}
                variant={userFilter === key ? "default" : "ghost"}
                size="sm"
                className="h-7 text-[11px] px-2.5 shrink-0"
                onClick={() => setUserFilter(key)}
              >
                {key === "all" ? "Todos" : USER_TYPE_CONFIG[key]?.label || key}
              </Button>
            ))}
          </div>

          <ScrollArea className="flex-1">
            {userLoading ? renderLoading() :
             userError ? renderError(userError) :
             userMemories.length === 0 ? renderEmpty("Kira aún no ha aprendido nada sobre ti. Chatea con ella y aprenderá automáticamente.") :
             (
              <AnimatePresence>
                {userMemories.map((mem, i) => {
                  const config = USER_TYPE_CONFIG[mem.type] || USER_TYPE_CONFIG.context;
                  const Icon = config.icon;
                  return (
                    <motion.div
                      key={mem.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="px-4 py-3 border-b border-border-subtle"
                    >
                      <div className="flex items-start gap-2.5">
                        <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${config.color}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm text-text">{mem.content}</span>
                            <span className="text-[10px] text-text-muted shrink-0">{timeAgo(mem.created_at)}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-[9px] h-4 px-1.5">
                              {config.label}
                            </Badge>
                            {mem.source === "auto" && (
                              <span className="text-[9px] text-text-muted">auto-detectado</span>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0 text-text-muted hover:text-destructive"
                          onClick={() => handleUserDelete(mem.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
          </ScrollArea>
        </>
      )}

      {/* ═══ TAB: Kronos ═══ */}
      {tab === "kronos" && (
        <>
          <div className="flex gap-1 px-4 py-2 border-b border-border-subtle">
            {(["all", "decision", "context", "preference"] as KronosFilter[]).map((key) => (
              <Button
                key={key}
                variant={kronosFilter === key ? "default" : "ghost"}
                size="sm"
                className="h-7 text-[11px] px-3"
                onClick={() => setKronosFilter(key)}
              >
                {key === "all" ? "Todos" : key === "decision" ? "Decisiones" : key === "context" ? "Contexto" : "Preferencias"}
              </Button>
            ))}
          </div>

          <ScrollArea className="flex-1">
            {kronosLoading ? renderLoading() :
             kronosError ? renderError(kronosError) :
             kronosMemories.length === 0 ? renderEmpty("Sin memorias") :
             (
              <AnimatePresence>
                {kronosMemories.map((mem, i) => {
                  const config = KRONOS_TYPE_CONFIG[mem.type] || KRONOS_TYPE_CONFIG.context;
                  const Icon = config.icon;
                  return (
                    <motion.div
                      key={mem.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="px-4 py-3 border-b border-border-subtle"
                    >
                      <div className="flex items-start gap-2.5">
                        <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${config.color}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-text truncate">{mem.title}</span>
                            <span className="text-[10px] text-text-muted shrink-0">{timeAgo(mem.created_at)}</span>
                          </div>
                          <p className="text-xs text-text-muted mt-0.5 line-clamp-2">{mem.content}</p>
                          {mem.tags.length > 0 && (
                            <div className="flex gap-1 mt-1.5 flex-wrap">
                              {mem.tags.map((tag) => (
                                <Badge key={tag} variant="outline" className="text-[9px] h-4 px-1.5">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0 text-text-muted hover:text-destructive"
                          onClick={() => handleKronosDelete(mem.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
          </ScrollArea>
        </>
      )}

      {/* ─── Create dialog: Kronos ─── */}
      <Dialog open={showKronosCreate} onOpenChange={setShowKronosCreate}>
        <DialogContent className="max-w-[340px]">
          <DialogHeader>
            <DialogTitle className="text-sm">Nueva memoria Kronos</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <select
              value={kronosFormType}
              onChange={(e) => setKronosFormType(e.target.value)}
              className="w-full text-sm bg-bg-surface text-text rounded-lg px-3 py-2 outline-none border border-border-subtle"
            >
              <option value="decision">Decisión</option>
              <option value="context">Contexto</option>
              <option value="preference">Preferencia</option>
            </select>
            <Input
              placeholder="Título"
              value={kronosFormTitle}
              onChange={(e) => setKronosFormTitle(e.target.value)}
              className="text-sm"
            />
            <textarea
              placeholder="Contenido..."
              value={kronosFormContent}
              onChange={(e) => setKronosFormContent(e.target.value)}
              rows={3}
              className="w-full text-sm bg-bg-surface text-text rounded-lg px-3 py-2 outline-none border border-border-subtle placeholder:text-text-muted resize-none"
            />
            <Button
              onClick={handleKronosCreate}
              disabled={kronosSaving || !kronosFormTitle.trim() || !kronosFormContent.trim()}
              className="w-full"
            >
              {kronosSaving ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Create dialog: User ─── */}
      <Dialog open={showUserCreate} onOpenChange={setShowUserCreate}>
        <DialogContent className="max-w-[340px]">
          <DialogHeader>
            <DialogTitle className="text-sm">Agregar dato sobre mí</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <select
              value={userFormType}
              onChange={(e) => setUserFormType(e.target.value)}
              className="w-full text-sm bg-bg-surface text-text rounded-lg px-3 py-2 outline-none border border-border-subtle"
            >
              <option value="fact">Dato</option>
              <option value="context">Contexto</option>
              <option value="preference">Preferencia</option>
              <option value="instruction">Instrucción</option>
            </select>
            <textarea
              placeholder="Ej: Mi negocio se llama Taco Loco y está en Miami..."
              value={userFormContent}
              onChange={(e) => setUserFormContent(e.target.value)}
              rows={3}
              className="w-full text-sm bg-bg-surface text-text rounded-lg px-3 py-2 outline-none border border-border-subtle placeholder:text-text-muted resize-none"
            />
            <Button
              onClick={handleUserCreate}
              disabled={userSaving || !userFormContent.trim()}
              className="w-full"
            >
              {userSaving ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
