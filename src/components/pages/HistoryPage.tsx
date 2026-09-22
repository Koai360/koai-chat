import { useEffect, useMemo, useState } from "react";
import { Search, Clock, Trash2, Pencil, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import {
  listConversations,
  searchConversations,
  deleteConversation as apiDeleteConversation,
  renameConversation as apiRenameConversation,
} from "@/lib/api";
import { navigate } from "@/lib/routing";
import { Skeleton } from "@/components/ui/Skeleton";
import { IconButton } from "@/components/ui/IconButton";
import { InlineConfirm, InlineRename } from "@/components/ui/InlineConfirm";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Conversation } from "@/types/api";

interface HistoryPageProps {
  /**
   * P1-3 audit: si se provee, borrar pasa por useChat.deleteConversation que
   * limpia activeId + messages cuando borrás la conv activa. Sino fallback raw.
   */
  onDeleteConversation?: (id: string) => Promise<void>;
}

/**
 * HistoryPage — lista completa de conversaciones con buscador y agrupación por día.
 *
 * S332 (rediseño de escritorio): con 565 conversaciones la columna fija de 290px dejaba
 * el 81% de un monitor 1920 en negro. Ahora la lista es DENSA (una línea por conversación,
 * fecha absoluta en mono a la derecha) y a partir de `xl` se reparte en dos columnas por
 * grupo, con un ancho máximo de 1180px para no estirarse hasta 4K. Renombrar y borrar
 * pasan EN LA FILA (antes `window.prompt`/`confirm`).
 */
export function HistoryPage({ onDeleteConversation }: HistoryPageProps = {}) {
  const [items, setItems] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // S158-b: antes el catch silencioso mostraba "Sin conversaciones aún" ante
  // un error de red — parecía pérdida de datos. Ahora error real + retry.
  const load = () => {
    setLoading(true);
    setLoadError(false);
    listConversations()
      .then(setItems)
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  // S332 F4: además del título, el backend busca en el CONTENIDO (≥3 letras, con debounce).
  const [contentHits, setContentHits] = useState<Map<string, string>>(new Map());
  const [searching, setSearching] = useState(false);
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setContentHits(new Map());
      setSearching(false);
      return;
    }
    let alive = true;
    setSearching(true);
    const t = setTimeout(() => {
      searchConversations(q)
        .then((hits) => { if (alive) setContentHits(new Map(hits.map((h) => [h.conversation_id, h.snippet]))); })
        .catch(() => { /* la búsqueda por título sigue funcionando sola */ })
        .finally(() => { if (alive) setSearching(false); });
    }, 350);
    return () => { alive = false; clearTimeout(t); };
  }, [query]);

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter((c) => (c.title || "").toLowerCase().includes(q) || contentHits.has(c.id));
  }, [items, query, contentHits]);

  const grouped = useMemo(() => groupByDay(filtered), [filtered]);

  const handleDelete = async (id: string) => {
    setBusyId(id);
    try {
      if (onDeleteConversation) {
        await onDeleteConversation(id);
      } else {
        await apiDeleteConversation(id);
      }
      setItems((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      console.warn("[HistoryPage] delete failed", err);
      toast.error("No se pudo borrar la conversación.");
    } finally {
      setBusyId(null);
      setDeletingId(null);
    }
  };

  const handleRename = async (conv: Conversation, next: string) => {
    setRenamingId(null);
    try {
      await apiRenameConversation(conv.id, next);
      setItems((prev) => prev.map((c) => (c.id === conv.id ? { ...c, title: next } : c)));
    } catch (err) {
      console.warn("[HistoryPage] rename failed", err);
      toast.error("No se pudo renombrar.");
    }
  };

  return (
    <div className="h-full flex flex-col">
      <header className="px-6 pt-6 pb-3 max-w-[1180px] w-full flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="display text-[24px] md:text-[28px] xl:text-[32px] font-semibold text-white mb-1">
            Historial
          </h1>
          <p className="text-sm text-white/45">
            {items.length > 0
              ? `${items.length} conversaciones${query.trim() ? ` · ${filtered.length} coinciden${searching ? "…" : ""}` : ""}`
              : "Tus conversaciones con Noa"}
          </p>
        </div>
        {/* Search */}
        <div className="relative w-full sm:w-[360px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-white/40" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por título o contenido…"
            aria-label="Buscar en el historial"
            className="w-full h-10 pl-10 pr-4 rounded-full bg-[var(--color-bg-elevated)] border border-white/[0.08] text-[14px] text-white placeholder:text-white/35 focus:border-[var(--color-noa)]/40 outline-none"
          />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 pb-8">
        <div className="max-w-[1180px] space-y-7 pt-2">
          {loading ? (
            <div className="space-y-2 pt-2 max-w-2xl">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} variant="rect" height={44} className="rounded-xl" />
              ))}
            </div>
          ) : items.length === 0 && loadError ? (
            <div className="flex flex-col items-center py-16 text-center">
              <p className="text-white/75 text-[15px] mb-1">No se pudo cargar el historial.</p>
              <p className="text-white/45 text-[13px] mb-4">Revisá tu conexión e intentá de nuevo.</p>
              <button
                onClick={load}
                className="px-4 py-2 rounded-full bg-white/[0.08] hover:bg-white/[0.14] text-white/90 text-[14px] transition-colors"
              >
                Reintentar
              </button>
            </div>
          ) : items.length === 0 ? (
            <EmptyState />
          ) : filtered.length === 0 ? (
            <p className="text-sm text-white/45 py-8">
              No hay conversaciones que coincidan con "{query}".
            </p>
          ) : (
            grouped.map(({ label, items: bucket }) => (
              <section key={label} aria-label={label}>
                <h2 className="flex items-baseline gap-2 mono text-[10px] uppercase tracking-[0.12em] text-white/45 mb-2 font-medium">
                  <span className="text-white/70">{label}</span>
                  <span>· {bucket.length}</span>
                </h2>
                {/* xl: dos columnas por grupo; cada fila es una línea (título · fecha · acciones) */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-6 gap-y-0.5">
                  {bucket.map((c) => (
                    <HistoryRow
                      key={c.id}
                      conv={c}
                      snippet={query.trim() && !(c.title || "").toLowerCase().includes(query.toLowerCase()) ? contentHits.get(c.id) : undefined}
                      renaming={renamingId === c.id}
                      deleting={deletingId === c.id}
                      busy={busyId === c.id}
                      onStartRename={() => { setDeletingId(null); setRenamingId(c.id); }}
                      onStartDelete={() => { setRenamingId(null); setDeletingId(c.id); }}
                      onCancel={() => { setRenamingId(null); setDeletingId(null); }}
                      onRename={(next) => handleRename(c, next)}
                      onDelete={() => handleDelete(c.id)}
                    />
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

const ABS_DATE = new Intl.DateTimeFormat("es", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

function HistoryRow({
  conv,
  snippet,
  renaming,
  deleting,
  busy,
  onStartRename,
  onStartDelete,
  onCancel,
  onRename,
  onDelete,
}: {
  conv: Conversation;
  /** Fragmento del mensaje que coincidió (sólo cuando el título no coincide). */
  snippet?: string;
  renaming: boolean;
  deleting: boolean;
  busy: boolean;
  onStartRename: () => void;
  onStartDelete: () => void;
  onCancel: () => void;
  onRename: (next: string) => void;
  onDelete: () => void;
}) {
  const title = conv.title || "Sin título";
  const ts = conv.last_message_at || conv.updated_at || conv.created_at;
  const isVoice = /^Voz\s·/.test(title);

  if (deleting) {
    return (
      <InlineConfirm
        question={`¿Borrar «${title}»?`}
        busy={busy}
        onConfirm={onDelete}
        onCancel={onCancel}
        className="min-h-[44px]"
      />
    );
  }
  if (renaming) {
    return (
      <InlineRename
        value={conv.title || ""}
        onSubmit={onRename}
        onCancel={onCancel}
        className="min-h-[44px] px-2"
      />
    );
  }

  return (
    <div className="group flex items-center gap-2 pl-3 pr-1 min-h-[44px] rounded-xl hover:bg-white/[0.04] transition-colors">
      <button
        onClick={() => navigate({ kind: "chat", conversationId: conv.id })}
        className="flex-1 flex items-center gap-3 text-left min-w-0"
        title={title}
      >
        {isVoice ? (
          <Clock className="size-4 text-white/35 shrink-0" />
        ) : (
          <MessageSquare className="size-4 text-white/35 shrink-0" />
        )}
        <span className="flex-1 min-w-0 flex flex-col">
          <span className="text-[14px] text-white/90 truncate">{title}</span>
          {snippet && <span className="text-[12px] text-white/45 truncate">{snippet}</span>}
        </span>
        <span
          className="mono text-[11px] text-white/45 tracking-tight tabular-nums shrink-0 hidden sm:inline"
          title={ts ? ABS_DATE.format(new Date(ts)) : undefined}
        >
          {relativeTime(ts)}
        </span>
      </button>
      <div className={cn("flex items-center shrink-0", "md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 opacity-100 transition-opacity")}>
        <IconButton
          icon={<Pencil className="size-4" />}
          label="Renombrar"
          size="sm"
          variant="ghost"
          onClick={onStartRename}
        />
        <IconButton
          icon={<Trash2 className="size-4" />}
          label="Borrar conversación"
          size="sm"
          variant="ghost"
          onClick={onStartDelete}
          className="hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]"
        />
      </div>
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
