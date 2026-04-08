import { useState, useMemo } from "react";
import { Search, LayoutGrid, List, ImageIcon, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Conversation } from "@/hooks/useChat";

interface Props {
  conversations: Conversation[];
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

type Tab = "all" | "latest";
type ViewMode = "grid" | "list";

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffDays === 0) return "Hoy";
  if (diffDays === 1) return "Ayer";
  if (diffDays < 7) return `${diffDays}d`;
  return d.toLocaleDateString("es-ES", { month: "short", day: "numeric" });
}

function getFirstUserMessage(c: Conversation): string {
  const msg = c.messages.find((m) => m.role === "user");
  return msg?.content || c.title || "Sin mensajes";
}

function getLastAssistantMessage(c: Conversation): string {
  const msgs = c.messages.filter((m) => m.role === "assistant");
  return msgs.length > 0 ? msgs[msgs.length - 1].content : "";
}

function hasImages(c: Conversation): boolean {
  return c.messages.some((m) => m.image);
}

export function ChatHistoryPage({ conversations, onSelect, onDelete }: Props) {
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  // Default list en mobile para máxima densidad; grid en desktop
  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    typeof window !== "undefined" && window.innerWidth < 768 ? "list" : "grid"
  );

  const filtered = useMemo(() => {
    let list = [...conversations];

    // Tab filter
    if (tab === "latest") {
      const sevenDaysAgo = Date.now() - 7 * 86_400_000;
      list = list.filter((c) => c.createdAt > sevenDaysAgo);
    }

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.messages.some((m) => m.content.toLowerCase().includes(q))
      );
    }

    // Sort by most recent
    list.sort((a, b) => b.createdAt - a.createdAt);
    return list;
  }, [conversations, tab, search]);

  return (
    <div className="flex flex-col h-full px-3 pt-2 pb-2">
      {/* Controles — una sola línea horizontal siempre */}
      <div className="flex items-center gap-2 mb-2">
        {/* Search — flex-1 */}
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-text-muted pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar..."
            className="pl-8 h-9 text-sm bg-bg-surface border-border"
          />
        </div>

        {/* Tab pills */}
        <div className="flex items-center gap-0.5 liquid-glass rounded-full p-0.5 shrink-0">
          {(["all", "latest"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-2.5 py-1 text-[11px] sm:text-xs rounded-full transition-all duration-200 ${
                tab === t
                  ? "bg-white/[0.08] text-text font-medium"
                  : "text-text-muted hover:text-text"
              }`}
            >
              {t === "all" ? "Todos" : "Recientes"}
            </button>
          ))}
        </div>

        {/* View toggle — solo desktop */}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
          className="text-text-muted hover:text-text shrink-0 hidden md:flex"
          aria-label={viewMode === "grid" ? "Vista lista" : "Vista cuadrícula"}
        >
          {viewMode === "grid" ? <List className="size-4" /> : <LayoutGrid className="size-4" />}
        </Button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 -mx-3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-text-muted">
            <Search className="size-10 mb-3 opacity-40" />
            <p className="text-sm">
              {search ? "No hay conversaciones que coincidan" : "Aún no hay conversaciones"}
            </p>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pb-4 px-3">
            {filtered.map((c) => (
              <ConversationCard
                key={c.id}
                conversation={c}
                onSelect={onSelect}
                onDelete={onDelete}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col pb-4">
            {filtered.map((c) => (
              <ConversationRow
                key={c.id}
                conversation={c}
                onSelect={onSelect}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function ConversationCard({
  conversation: c,
  onSelect,
  onDelete,
}: {
  conversation: Conversation;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div
      onClick={() => onSelect(c.id)}
      className="bg-bg-surface border border-border rounded-2xl p-3 cursor-pointer hover:border-kira/20 hover:scale-[1.01] transition-all duration-300 group relative"
    >
      {/* Delete button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(c.id);
        }}
        className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-bg-elevated text-text-muted hover:text-danger"
      >
        <Trash2 className="size-3.5" />
      </button>

      {/* Date + images indicator */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-[10px] text-text-muted font-mono">{formatDate(c.createdAt)}</span>
        {hasImages(c) && <ImageIcon className="size-3 text-text-muted" />}
      </div>

      {/* User message preview */}
      <p className="text-sm text-text line-clamp-2 mb-1">{getFirstUserMessage(c)}</p>

      {/* Assistant preview — solo desktop */}
      {getLastAssistantMessage(c) && (
        <p className="text-xs text-text-muted line-clamp-2 hidden sm:block">
          {getLastAssistantMessage(c)}
        </p>
      )}
    </div>
  );
}

function ConversationRow({
  conversation: c,
  onSelect,
  onDelete,
}: {
  conversation: Conversation;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div
      onClick={() => onSelect(c.id)}
      className="px-3 py-2.5 cursor-pointer flex items-center gap-2.5 group border-b border-border/40 active:bg-bg-surface transition-colors"
    >
      {/* Main text */}
      <p className="flex-1 min-w-0 text-[14px] text-text truncate">
        {getFirstUserMessage(c)}
      </p>

      {/* Image indicator */}
      {hasImages(c) && <ImageIcon className="size-3 text-text-subtle shrink-0" />}

      {/* Date */}
      <span className="text-[10px] text-text-subtle font-mono shrink-0">
        {formatDate(c.createdAt)}
      </span>

      {/* Delete — siempre visible pero sutil en mobile, aparece en hover en desktop */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(c.id);
        }}
        className="p-1 rounded-md text-text-subtle/50 hover:text-danger active:text-danger md:text-text-muted md:opacity-0 md:group-hover:opacity-100 transition-all shrink-0"
        aria-label="Eliminar"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}
