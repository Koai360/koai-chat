import { useEffect, useMemo, useState } from "react";
import { Search, Clock, Trash2, Pencil } from "lucide-react";
import {
  listConversations,
  deleteConversation as apiDeleteConversation,
  renameConversation as apiRenameConversation,
} from "@/lib/api";
import { navigate } from "@/lib/routing";
import { Skeleton } from "@/components/ui/Skeleton";
import { IconButton } from "@/components/ui/IconButton";
import { relativeTime } from "@/lib/format";
import type { Conversation } from "@/types/api";

/**
 * HistoryPage — lista completa de conversaciones con buscador y agrupación por día.
 */
export function HistoryPage() {
  const [items, setItems] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    listConversations()
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter((c) => (c.title || "").toLowerCase().includes(q));
  }, [items, query]);

  const grouped = useMemo(() => groupByDay(filtered), [filtered]);

  const handleDelete = async (id: string) => {
    if (!confirm("¿Borrar esta conversación?")) return;
    try {
      await apiDeleteConversation(id);
      setItems((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      console.warn("[HistoryPage] delete failed", err);
    }
  };

  const handleRename = async (conv: Conversation) => {
    const next = window.prompt("Nuevo nombre del chat:", conv.title || "");
    if (!next || next.trim() === conv.title) return;
    try {
      await apiRenameConversation(conv.id, next.trim());
      setItems((prev) => prev.map((c) => (c.id === conv.id ? { ...c, title: next.trim() } : c)));
    } catch (err) {
      console.warn("[HistoryPage] rename failed", err);
      window.alert("No se pudo renombrar.");
    }
  };

  return (
    <div className="h-full flex flex-col">
      <header className="px-6 pt-6 pb-3">
        <h1 className="display text-[24px] md:text-[28px] font-semibold text-white mb-1">
          Historial
        </h1>
        <p className="text-sm text-white/45">
          {items.length > 0 ? `${items.length} conversaciones` : "Tus conversaciones con Noa"}
        </p>
      </header>

      {/* Search */}
      <div className="px-6 pb-4">
        <div className="relative max-w-2xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-white/40" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar en historial..."
            className="w-full h-11 pl-10 pr-4 rounded-full bg-[var(--color-bg-elevated)] border border-white/[0.08] text-[14px] text-white placeholder:text-white/35 focus:border-[var(--color-noa)]/40 outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-8">
        <div className="max-w-2xl space-y-6">
          {loading ? (
            <div className="space-y-2 pt-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} variant="rect" height={56} className="rounded-xl" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState />
          ) : filtered.length === 0 ? (
            <p className="text-sm text-white/45 py-8">
              No hay conversaciones que coincidan con "{query}".
            </p>
          ) : (
            grouped.map(({ label, items: bucket }) => (
              <section key={label}>
                <h2 className="mono text-[10px] uppercase tracking-[0.12em] text-white/45 mb-2 font-medium">
                  {label}
                </h2>
                <div className="space-y-1">
                  {bucket.map((c) => (
                    <HistoryItem key={c.id} conv={c} onDelete={handleDelete} onRename={handleRename} />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function HistoryItem({
  conv,
  onDelete,
  onRename,
}: {
  conv: Conversation;
  onDelete: (id: string) => void;
  onRename: (conv: Conversation) => void;
}) {
  const title = conv.title || "Sin título";
  const ts = conv.last_message_at || conv.updated_at || conv.created_at;

  return (
    <div className="group flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-white/[0.04] transition">
      <button
        onClick={() => navigate({ kind: "chat", conversationId: conv.id })}
        className="flex-1 flex items-start gap-3 text-left min-w-0"
      >
        <Clock className="size-4 text-white/40 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[14px] text-white/95 font-medium truncate">{title}</p>
          <p className="mono text-[11px] text-white/45 mt-0.5 tracking-tight">{relativeTime(ts)}</p>
        </div>
      </button>
      <IconButton
        icon={<Pencil className="size-4" />}
        label="Renombrar"
        size="sm"
        variant="ghost"
        onClick={() => onRename(conv)}
        className="md:opacity-0 md:group-hover:opacity-100 opacity-100"
      />
      <IconButton
        icon={<Trash2 className="size-4" />}
        label="Borrar conversación"
        size="sm"
        variant="ghost"
        onClick={() => onDelete(conv.id)}
        className="md:opacity-0 md:group-hover:opacity-100 opacity-100 hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]"
      />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <Clock className="size-12 text-white/20 mb-3" />
      <h2 className="text-lg text-white/85 mb-1">Sin conversaciones aún</h2>
      <p className="text-sm text-white/45 max-w-sm">
        Empezá una nueva conversación con Noa desde el botón "Nuevo chat".
      </p>
    </div>
  );
}

function groupByDay(items: Conversation[]): Array<{ label: string; items: Conversation[] }> {
  const buckets: Record<string, Conversation[]> = {
    Hoy: [],
    Ayer: [],
    "Esta semana": [],
    "Este mes": [],
    Anteriores: [],
  };

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86400000;
  const weekAgo = today - 7 * 86400000;
  const monthAgo = today - 30 * 86400000;

  for (const c of items) {
    const ts = new Date(c.last_message_at || c.updated_at || c.created_at).getTime();
    if (ts >= today) buckets["Hoy"].push(c);
    else if (ts >= yesterday) buckets["Ayer"].push(c);
    else if (ts >= weekAgo) buckets["Esta semana"].push(c);
    else if (ts >= monthAgo) buckets["Este mes"].push(c);
    else buckets["Anteriores"].push(c);
  }

  return Object.entries(buckets)
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => ({ label, items }));
}
