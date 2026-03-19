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

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getFirstUserMessage(c: Conversation): string {
  const msg = c.messages.find((m) => m.role === "user");
  return msg?.content || c.title || "No messages";
}

function getLastAssistantMessage(c: Conversation): string {
  const msgs = c.messages.filter((m) => m.role === "assistant");
  return msgs.length > 0 ? msgs[msgs.length - 1].content : "";
}

function hasImages(c: Conversation): boolean {
  return c.messages.some((m) => m.image);
}

function getResponseCount(c: Conversation): number {
  return c.messages.filter((m) => m.role === "assistant").length;
}

export function ChatHistoryPage({ conversations, onSelect, onDelete }: Props) {
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

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
    <div className="flex flex-col h-full px-4 pt-4 pb-2">
      {/* Header */}
      <h1 className="text-2xl font-medium text-text mb-4 font-display">Chat History</h1>

      {/* Controls */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {/* Tab pills */}
        <div className="flex items-center gap-1 bg-bg-elevated rounded-lg p-1">
          {(["all", "latest"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                tab === t
                  ? "bg-bg-surface text-text font-medium"
                  : "text-text-muted hover:text-text"
              }`}
            >
              {t === "all" ? "All" : "Latest"}
            </button>
          ))}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Search */}
        <div className="relative w-48 sm:w-56">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-text-muted" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search chats..."
            className="pl-8 h-8 text-sm bg-bg-surface border-border"
          />
        </div>

        {/* View toggle */}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
          className="text-text-muted hover:text-text"
        >
          {viewMode === "grid" ? <List className="size-4" /> : <LayoutGrid className="size-4" />}
        </Button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-text-muted">
            <Search className="size-10 mb-3 opacity-40" />
            <p className="text-sm">
              {search ? "No chats match your search" : "No conversations yet"}
            </p>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pb-4">
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
          <div className="flex flex-col gap-2 pb-4">
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
      className="bg-bg-surface border border-border rounded-xl p-4 cursor-pointer hover:border-text-muted/30 transition-colors group relative"
    >
      {/* Delete button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(c.id);
        }}
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-bg-elevated text-text-muted hover:text-danger"
      >
        <Trash2 className="size-3.5" />
      </button>

      {/* Date + response count */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs text-text-muted">{formatDate(c.createdAt)}</span>
        <span className="text-xs text-text-subtle">
          · {getResponseCount(c)} Response{getResponseCount(c) !== 1 ? "s" : ""}
        </span>
        {hasImages(c) && <ImageIcon className="size-3 text-text-muted" />}
      </div>

      {/* User message preview */}
      <p className="text-sm text-text line-clamp-2 mb-1.5">{getFirstUserMessage(c)}</p>

      {/* Assistant preview */}
      {getLastAssistantMessage(c) && (
        <p className="text-xs text-text-muted line-clamp-2">
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
      className="bg-bg-surface border border-border rounded-lg px-4 py-3 cursor-pointer hover:border-text-muted/30 transition-colors flex items-center gap-4 group"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs text-text-muted">{formatDate(c.createdAt)}</span>
          {hasImages(c) && <ImageIcon className="size-3 text-text-muted" />}
        </div>
        <p className="text-sm text-text truncate">{getFirstUserMessage(c)}</p>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(c.id);
        }}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-bg-elevated text-text-muted hover:text-danger shrink-0"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}
