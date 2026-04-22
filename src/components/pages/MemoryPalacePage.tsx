import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Trash2, Pencil, Check, X, Loader2, Sparkles } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  fetchMemoryPalace,
  deletePalaceMemory,
  editPalaceMemory,
  type Memory,
  type MemoryPalaceResponse,
} from "@/lib/api";

const FILTERS: { key: string; label: string }[] = [
  { key: "", label: "Todas" },
  { key: "instruction", label: "Instrucciones" },
  { key: "conversation", label: "Conversación" },
];

const TYPE_COLORS: Record<string, string> = {
  instruction: "text-amber-400 bg-amber-400/10 border-amber-400/30",
  conversation: "text-noa bg-noa/10 border-noa/20",
  fact: "text-blue-400 bg-blue-400/10 border-blue-400/30",
  preference: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
};

export function MemoryPalacePage() {
  const [data, setData] = useState<MemoryPalaceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetchMemoryPalace(filter || undefined)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = useCallback(
    async (id: string) => {
      setBusyId(id);
      try {
        await deletePalaceMemory(id);
        setData((prev) =>
          prev
            ? { ...prev, memories: prev.memories.filter((m) => m.id !== id) }
            : prev,
        );
      } catch {
        // no-op
      } finally {
        setBusyId(null);
      }
    },
    [],
  );

  const startEdit = (m: Memory) => {
    setEditingId(m.id);
    setEditContent(m.content);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditContent("");
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const id = editingId;
    const content = editContent.trim();
    if (!content) return;
    setBusyId(id);
    try {
      await editPalaceMemory(id, content);
      setData((prev) =>
        prev
          ? {
              ...prev,
              memories: prev.memories.map((m) =>
                m.id === id ? { ...m, content } : m,
              ),
            }
          : prev,
      );
      cancelEdit();
    } catch {
      // no-op
    } finally {
      setBusyId(null);
    }
  };

  const sortedMemories = useMemo(() => {
    if (!data) return [];
    // Instrucciones primero, luego por relevance, luego por created_at
    return [...data.memories].sort((a, b) => {
      if (a.entity_type !== b.entity_type) {
        if (a.entity_type === "instruction") return -1;
        if (b.entity_type === "instruction") return 1;
      }
      const rel = (b.relevance_score ?? 0) - (a.relevance_score ?? 0);
      if (rel !== 0) return rel;
      return b.created_at.localeCompare(a.created_at);
    });
  }, [data]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 86400000) return "Hoy";
    if (diff < 172800000) return "Ayer";
    if (diff < 604800000) return `Hace ${Math.floor(diff / 86400000)}d`;
    return d.toLocaleDateString("es-ES", { month: "short", day: "numeric" });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-border">
        <div className="flex items-center gap-2 mb-1">
          <Brain className="size-5 text-noa" />
          <h1 className="text-lg font-display font-medium text-text">
            Memory Palace
          </h1>
          {data && (
            <span className="text-xs text-text-subtle font-mono ml-auto">
              {data.stats.total} memorias · {data.stats.total_hits} recalls
            </span>
          )}
        </div>
        <p className="text-xs text-text-muted">
          Lo que Noa recuerda de ti. Edita o borra lo que no aplique — se actualiza
          en tiempo real.
        </p>

        {/* Filtros */}
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`shrink-0 text-xs px-3 py-1.5 rounded-full border transition-all ${
                filter === f.key
                  ? "bg-noa/15 border-noa/40 text-noa"
                  : "bg-bg-surface border-border text-text-muted hover:bg-bg-hover"
              }`}
            >
              {f.label}
              {data && f.key && (
                <span className="ml-1 opacity-60">
                  {data.stats.by_type[f.key] ?? 0}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-5 animate-spin text-text-muted" />
          </div>
        ) : !data || sortedMemories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center text-text-muted">
            <Sparkles className="size-10 mb-3 opacity-30" />
            <p className="text-sm">Aún no hay memorias</p>
            <p className="text-xs text-text-subtle mt-2 max-w-xs">
              Sigue conversando. Cada noche Noa destila lo durable y lo guarda aquí.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 px-3 py-3">
            <AnimatePresence mode="popLayout">
              {sortedMemories.map((m) => {
                const isEditing = editingId === m.id;
                const isBusy = busyId === m.id;
                const color =
                  TYPE_COLORS[m.entity_type] ||
                  "text-text-muted bg-bg-surface border-border";
                return (
                  <motion.div
                    key={m.id}
                    layout
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.18 }}
                    className="group border border-border rounded-xl p-3 bg-bg-surface hover:bg-bg-hover transition-colors"
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <span
                        className={`shrink-0 text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full border ${color}`}
                      >
                        {m.entity_type}
                      </span>
                      {m.source && (
                        <span className="shrink-0 text-[10px] text-text-subtle font-mono">
                          {m.source}
                        </span>
                      )}
                      <span className="ml-auto text-[10px] text-text-subtle font-mono">
                        {formatDate(m.created_at)}
                      </span>
                    </div>

                    {isEditing ? (
                      <div className="space-y-2">
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          rows={3}
                          autoFocus
                          className="w-full text-sm text-text bg-bg-base border border-border rounded-lg px-3 py-2 resize-none outline-none focus:border-noa/40"
                        />
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={cancelEdit}
                            className="text-xs px-3 py-1.5 rounded-lg border border-border text-text-muted hover:bg-bg-hover"
                          >
                            <X className="size-3 inline mr-1" /> Cancelar
                          </button>
                          <button
                            onClick={saveEdit}
                            disabled={isBusy || !editContent.trim()}
                            className="text-xs px-3 py-1.5 rounded-lg bg-noa/20 border border-noa/30 text-noa hover:bg-noa/30 disabled:opacity-40"
                          >
                            {isBusy ? (
                              <Loader2 className="size-3 inline mr-1 animate-spin" />
                            ) : (
                              <Check className="size-3 inline mr-1" />
                            )}{" "}
                            Guardar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-text leading-relaxed whitespace-pre-wrap">
                        {m.content}
                      </p>
                    )}

                    {!isEditing && (
                      <div className="flex items-center gap-3 mt-2 pt-2 border-t border-border/60">
                        <div className="flex items-center gap-3 text-[10px] text-text-subtle font-mono">
                          {(m.hit_count ?? 0) > 0 && (
                            <span title="Veces recalled">
                              ♻ {m.hit_count}
                            </span>
                          )}
                          <span title="Relevance score">
                            {(m.relevance_score ?? 1.0).toFixed(1)}×
                          </span>
                        </div>
                        <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => startEdit(m)}
                            disabled={isBusy}
                            className="p-1.5 text-text-muted hover:text-noa transition-colors rounded-md hover:bg-bg-base"
                            aria-label="Editar memoria"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(m.id)}
                            disabled={isBusy}
                            className="p-1.5 text-text-muted hover:text-danger transition-colors rounded-md hover:bg-bg-base"
                            aria-label="Olvidar memoria"
                          >
                            {isBusy ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="size-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
