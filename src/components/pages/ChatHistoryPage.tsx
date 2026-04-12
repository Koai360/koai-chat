import { useState, useMemo } from "react";
import { Search, LayoutGrid, List, ImageIcon, Trash2, Pencil, Download } from "lucide-react";
import { exportAsText } from "@/lib/exportChat";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { Conversation } from "@/hooks/useChat";

interface Props {
  conversations: Conversation[];
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, newTitle: string) => void;
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

function getDisplayTitle(c: Conversation): string {
  // Prioriza c.title (single source of truth — se auto-set al primer mensaje
  // y se actualiza al renombrar). Fallback al primer mensaje solo si title
  // está vacío (edge case) o es el placeholder "Nueva conversación" sin mensajes.
  if (c.title && c.title !== "Nueva conversación") return c.title;
  const msg = c.messages.find((m) => m.role === "user");
  return msg?.content || c.title || "Nueva conversación";
}

function getLastAssistantMessage(c: Conversation): string {
  const msgs = c.messages.filter((m) => m.role === "assistant");
  return msgs.length > 0 ? msgs[msgs.length - 1].content : "";
}

function hasImages(c: Conversation): boolean {
  return c.messages.some((m) => m.image);
}

export function ChatHistoryPage({ conversations, onSelect, onDelete, onRename }: Props) {
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  // Default list en mobile para máxima densidad; grid en desktop
  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    typeof window !== "undefined" && window.innerWidth < 768 ? "list" : "grid"
  );
  // Dialog state para renombrar
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  // Dialog state para confirmar delete
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const deletingConvo = deletingId ? conversations.find((c) => c.id === deletingId) : null;

  const confirmDelete = (id: string) => setDeletingId(id);
  const cancelDelete = () => setDeletingId(null);
  const executeDelete = () => {
    if (deletingId) {
      onDelete(deletingId);
      setDeletingId(null);
    }
  };

  const openEdit = (id: string, currentTitle: string) => {
    setEditingId(id);
    setEditingTitle(currentTitle);
  };

  const closeEdit = () => {
    setEditingId(null);
    setEditingTitle("");
  };

  const submitEdit = () => {
    if (editingId && editingTitle.trim()) {
      onRename(editingId, editingTitle.trim());
    }
    closeEdit();
  };

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
                onDelete={confirmDelete}
                onEdit={openEdit}
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
                onDelete={confirmDelete}
                onEdit={openEdit}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Dialog de rename */}
      <Dialog open={editingId !== null} onOpenChange={(open) => !open && closeEdit()}>
        <DialogContent className="sm:max-w-[420px] bg-bg-elevated border-border">
          <DialogHeader>
            <DialogTitle className="text-text">Renombrar conversación</DialogTitle>
          </DialogHeader>
          <Input
            value={editingTitle}
            onChange={(e) => setEditingTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitEdit();
              }
            }}
            placeholder="Nuevo nombre"
            className="bg-bg-surface border-border text-text"
            autoFocus
          />
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" onClick={closeEdit}>
              Cancelar
            </Button>
            <Button onClick={submitEdit} disabled={!editingTitle.trim()}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmación de delete */}
      <Dialog open={deletingId !== null} onOpenChange={(open) => !open && cancelDelete()}>
        <DialogContent className="sm:max-w-[420px] bg-bg-elevated border-border">
          <DialogHeader>
            <DialogTitle className="text-text">¿Eliminar conversación?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-text-muted">
            {deletingConvo
              ? `"${getDisplayTitle(deletingConvo)}" se eliminará permanentemente. Esta acción no se puede deshacer.`
              : "Esta acción no se puede deshacer."}
          </p>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" onClick={cancelDelete}>
              Cancelar
            </Button>
            <Button
              onClick={executeDelete}
              className="bg-danger hover:bg-danger/90 text-white"
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ConversationCard({
  conversation: c,
  onSelect,
  onDelete,
  onEdit,
}: {
  conversation: Conversation;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, currentTitle: string) => void;
}) {
  return (
    <div
      onClick={() => onSelect(c.id)}
      className="bg-bg-surface border border-border rounded-2xl p-3 cursor-pointer hover:border-noa/20 hover:scale-[1.01] transition-all duration-300 group relative"
    >
      {/* Action buttons — edit + delete */}
      <div className="absolute top-2.5 right-2.5 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(c.id, getDisplayTitle(c));
          }}
          className="p-1 rounded-md hover:bg-bg-elevated text-text-muted hover:text-text"
          aria-label="Renombrar"
        >
          <Pencil className="size-3.5" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (c.messages.length > 0) exportAsText(getDisplayTitle(c), c.messages);
          }}
          className="p-1 rounded-md hover:bg-bg-elevated text-text-muted hover:text-noa"
          aria-label="Exportar"
        >
          <Download className="size-3.5" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(c.id);
          }}
          className="p-1 rounded-md hover:bg-bg-elevated text-text-muted hover:text-danger"
          aria-label="Eliminar"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      {/* Date + images indicator */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-[10px] text-text-muted font-mono">{formatDate(c.createdAt)}</span>
        {hasImages(c) && <ImageIcon className="size-3 text-text-muted" />}
      </div>

      {/* User message preview */}
      <p className="text-sm text-text line-clamp-2 mb-1">{getDisplayTitle(c)}</p>

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
  onEdit,
}: {
  conversation: Conversation;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, currentTitle: string) => void;
}) {
  return (
    <div
      onClick={() => onSelect(c.id)}
      className="px-3 py-2.5 cursor-pointer flex items-center gap-2 group border-b border-border/40 active:bg-bg-surface transition-colors"
    >
      {/* Main text */}
      <p className="flex-1 min-w-0 text-[14px] text-text truncate">
        {getDisplayTitle(c)}
      </p>

      {/* Image indicator */}
      {hasImages(c) && <ImageIcon className="size-3 text-text-subtle shrink-0" />}

      {/* Date */}
      <span className="text-[10px] text-text-subtle font-mono shrink-0">
        {formatDate(c.createdAt)}
      </span>

      {/* Edit — siempre visible pero sutil en mobile */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onEdit(c.id, getDisplayTitle(c));
        }}
        className="p-1 rounded-md text-text-subtle/50 hover:text-text active:text-text md:text-text-muted md:opacity-0 md:group-hover:opacity-100 transition-all shrink-0"
        aria-label="Renombrar"
      >
        <Pencil className="size-3.5" />
      </button>

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
