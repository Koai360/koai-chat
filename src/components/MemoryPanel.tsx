import { useState, useEffect } from "react";
import type { KronosMemory } from "../lib/api";
import { fetchMemories, createMemory, deleteMemory } from "../lib/api";

interface Props {
  onClose: () => void;
}

type FilterType = "all" | "decision" | "context" | "preference";

const TYPE_ICONS: Record<string, string> = {
  decision: "\uD83E\uDDE0",
  context: "\u2139\uFE0F",
  preference: "\u2B50",
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Ahora";
  if (mins < 60) return `Hace ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hace ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Hace ${days}d`;
  return new Date(dateStr).toLocaleDateString("es", { day: "numeric", month: "short" });
}

export function MemoryPanel({ onClose }: Props) {
  const [memories, setMemories] = useState<KronosMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [showForm, setShowForm] = useState(false);
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
      setShowForm(false);
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

  const tabs: { key: FilterType; label: string }[] = [
    { key: "all", label: "Todos" },
    { key: "decision", label: "Decisiones" },
    { key: "context", label: "Contexto" },
    { key: "preference", label: "Preferencias" },
  ];

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#0a0a0c]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-white/10 safe-top">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Memoria</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowForm(!showForm)}
            className="text-xs text-[#572c77] dark:text-[#57C74A] font-medium px-2 py-1 rounded-lg active:bg-[#572c77]/10 transition-colors"
          >
            {showForm ? "Cancelar" : "+ Nueva"}
          </button>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-500 dark:text-gray-400 active:bg-gray-100 dark:active:bg-white/10"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* New memory form */}
      {showForm && (
        <div className="px-4 py-3 border-b border-gray-100 dark:border-white/5 space-y-2">
          <select
            value={formType}
            onChange={(e) => setFormType(e.target.value)}
            className="w-full text-sm bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 outline-none border border-gray-200 dark:border-white/10"
          >
            <option value="decision">Decisi&oacute;n</option>
            <option value="context">Contexto</option>
            <option value="preference">Preferencia</option>
          </select>
          <input
            type="text"
            placeholder="Titulo"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            className="w-full text-sm bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 outline-none border border-gray-200 dark:border-white/10 placeholder-gray-400 dark:placeholder-gray-500"
          />
          <textarea
            placeholder="Contenido..."
            value={formContent}
            onChange={(e) => setFormContent(e.target.value)}
            rows={3}
            className="w-full text-sm bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 outline-none border border-gray-200 dark:border-white/10 placeholder-gray-400 dark:placeholder-gray-500 resize-none"
          />
          <button
            onClick={handleCreate}
            disabled={saving || !formTitle.trim() || !formContent.trim()}
            className="w-full text-sm font-medium py-2 rounded-lg bg-[#572c77] text-white active:bg-[#572c77]/80 disabled:opacity-40 transition-colors"
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 px-4 py-2 border-b border-gray-100 dark:border-white/5">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              filter === tab.key
                ? "bg-[#572c77] text-white"
                : "text-gray-500 dark:text-gray-400 active:bg-gray-100 dark:active:bg-white/10"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-[#572c77] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-32 px-8 text-center">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        ) : memories.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 px-8 text-center">
            <p className="text-sm text-gray-400 dark:text-gray-500">Sin memorias</p>
          </div>
        ) : (
          memories.map((mem) => (
            <div
              key={mem.id}
              className="px-4 py-3 border-b border-gray-100 dark:border-white/5"
            >
              <div className="flex items-start gap-2">
                <span className="text-base flex-shrink-0 mt-0.5">
                  {TYPE_ICONS[mem.type] || TYPE_ICONS.context}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {mem.title}
                    </span>
                    <span className="text-[11px] text-gray-400 dark:text-gray-500 flex-shrink-0">
                      {timeAgo(mem.created_at)}
                    </span>
                  </div>
                  <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                    {mem.content}
                  </p>
                  {mem.tags.length > 0 && (
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {mem.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-gray-400"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(mem.id)}
                  className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-gray-400 active:bg-red-500/10 active:text-red-400 transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
