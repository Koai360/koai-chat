import { useState, useEffect } from "react";
import type { KronosMemory } from "@/lib/api";
import { fetchMemories, createMemory, deleteMemory } from "@/lib/api";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, X, Plus, Trash2, AlertCircle, Lightbulb, Info, Star } from "lucide-react";

interface Props {
  onClose: () => void;
}

type FilterType = "all" | "decision" | "context" | "preference";

const TYPE_CONFIG: Record<string, { icon: typeof Brain; color: string }> = {
  decision: { icon: Lightbulb, color: "text-yellow-400" },
  context: { icon: Info, color: "text-blue-400" },
  preference: { icon: Star, color: "text-kira" },
};

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
  const [memories, setMemories] = useState<KronosMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [formType, setFormType] = useState("decision");
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [saving, setSaving] = useState(false);

  const loadMemories = () => {
    setLoading(true);
    setError("");
    const typeParam = filter === "all" ? undefined : filter;
    fetchMemories(typeParam)
      .then(setMemories)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadMemories();
  }, [filter]);

  const handleCreate = async () => {
    if (!formTitle.trim() || !formContent.trim()) return;
    setSaving(true);
    try {
      await createMemory({ type: formType, title: formTitle.trim(), content: formContent.trim() });
      setFormTitle("");
      setFormContent("");
      setShowCreate(false);
      loadMemories();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMemory(id);
      setMemories((prev) => prev.filter((m) => m.id !== id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al eliminar");
    }
  };

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
            onClick={() => setShowCreate(true)}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Nueva
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-text-muted" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 px-4 py-2 border-b border-border-subtle">
        {(["all", "decision", "context", "preference"] as FilterType[]).map((key) => (
          <Button
            key={key}
            variant={filter === key ? "default" : "ghost"}
            size="sm"
            className="h-7 text-[11px] px-3"
            onClick={() => setFilter(key)}
          >
            {key === "all" ? "Todos" : key === "decision" ? "Decisiones" : key === "context" ? "Contexto" : "Preferencias"}
          </Button>
        ))}
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="px-4 py-4 space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-full" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-32 px-8 text-center">
            <AlertCircle className="h-8 w-8 text-destructive/50 mb-2" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        ) : memories.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 px-8 text-center">
            <Brain className="h-10 w-10 text-text-muted/30 mb-3" />
            <p className="text-sm text-text-muted">Sin memorias</p>
          </div>
        ) : (
          <AnimatePresence>
            {memories.map((mem, i) => {
              const config = TYPE_CONFIG[mem.type] || TYPE_CONFIG.context;
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
                      onClick={() => handleDelete(mem.id)}
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

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-[340px]">
          <DialogHeader>
            <DialogTitle className="text-sm">Nueva memoria</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <select
              value={formType}
              onChange={(e) => setFormType(e.target.value)}
              className="w-full text-sm bg-bg-surface text-text rounded-lg px-3 py-2 outline-none border border-border-subtle"
            >
              <option value="decision">Decisión</option>
              <option value="context">Contexto</option>
              <option value="preference">Preferencia</option>
            </select>
            <Input
              placeholder="Título"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              className="text-sm"
            />
            <textarea
              placeholder="Contenido..."
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              rows={3}
              className="w-full text-sm bg-bg-surface text-text rounded-lg px-3 py-2 outline-none border border-border-subtle placeholder:text-text-muted resize-none"
            />
            <Button
              onClick={handleCreate}
              disabled={saving || !formTitle.trim() || !formContent.trim()}
              className="w-full"
            >
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
