import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search, SquarePen, Inbox, Image as ImageIcon, Clock, Settings, MessageSquare, CornerDownLeft } from "lucide-react";
import { navigate, type Route } from "@/lib/routing";
import { relativeTime } from "@/lib/format";
import { MOD_LABEL } from "@/hooks/useHotkeys";
import { cn } from "@/lib/cn";
import type { Conversation } from "@/types/api";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  conversations: Conversation[];
  onNewChat: () => void;
  onSelectConversation: (id: string) => void;
  inboxCount?: number;
}

type Item =
  | { kind: "action"; id: string; label: string; hint?: string; icon: React.ReactNode; run: () => void }
  | { kind: "conversation"; id: string; label: string; hint: string; icon: React.ReactNode; run: () => void };

/** Búsqueda tolerante: todas las palabras del query tienen que aparecer (en cualquier orden). */
function matches(haystack: string, query: string): boolean {
  const h = haystack.toLowerCase();
  return query.toLowerCase().split(/\s+/).filter(Boolean).every((w) => h.includes(w));
}

/**
 * CommandPalette — ⌘K (S332, F1). Un solo lugar para saltar a una conversación de las 565 o
 * a una sección, sin tocar el mouse. Lista: acciones arriba (fijas) y conversaciones por
 * título abajo (máx 12, más recientes primero). ↑↓ navegan, Enter ejecuta, Esc cierra.
 *
 * Es un overlay propio y no un Sheet: en escritorio el buscador va centrado y flotando,
 * no anclado a un borde.
 */
export function CommandPalette({ open, onClose, conversations, onNewChat, onSelectConversation, inboxCount = 0 }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setCursor(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  const go = (route: Route) => {
    onClose();
    navigate(route);
  };

  const actions: Item[] = useMemo(() => [
    { kind: "action", id: "new", label: "Nuevo chat", hint: `${MOD_LABEL}⇧O`, icon: <SquarePen className="size-4" />, run: () => { onClose(); onNewChat(); } },
    { kind: "action", id: "bandeja", label: inboxCount ? `Bandeja · ${inboxCount} pendientes` : "Bandeja", icon: <Inbox className="size-4" />, run: () => go({ kind: "bandeja" }) },
    { kind: "action", id: "galeria", label: "Galería", icon: <ImageIcon className="size-4" />, run: () => go({ kind: "galeria" }) },
    { kind: "action", id: "historial", label: "Historial", icon: <Clock className="size-4" />, run: () => go({ kind: "historial" }) },
    { kind: "action", id: "config", label: "Configuración", icon: <Settings className="size-4" />, run: () => go({ kind: "config" }) },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [inboxCount, onNewChat, onClose]);

  const items: Item[] = useMemo(() => {
    const q = query.trim();
    const acts = q ? actions.filter((a) => matches(a.label, q)) : actions;
    const convs: Item[] = conversations
      .filter((c) => !q || matches(c.title || "Nueva conversación", q))
      .slice(0, q ? 12 : 8)
      .map((c) => ({
        kind: "conversation",
        id: c.id,
        label: c.title || "Nueva conversación",
        hint: relativeTime(c.last_message_at || c.updated_at || c.created_at),
        icon: <MessageSquare className="size-4" />,
        run: () => { onClose(); onSelectConversation(c.id); },
      }));
    return [...acts, ...convs];
  }, [query, actions, conversations, onClose, onSelectConversation]);

  useEffect(() => {
    setCursor(0);
  }, [query]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${cursor}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      items[cursor]?.run();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  const firstConvIndex = items.findIndex((i) => i.kind === "conversation");

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-[2px]"
            onClick={onClose}
          />
          <motion.div
            key="panel"
            role="dialog"
            aria-modal="true"
            aria-label="Buscar conversaciones y acciones"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className={cn(
              "fixed z-[80] left-1/2 -translate-x-1/2 top-[12vh] w-[min(640px,calc(100vw-32px))]",
              "rounded-2xl overflow-hidden",
              "bg-[var(--color-bg-overlay)] border border-[var(--color-border-hi)]",
              "shadow-[var(--shadow-deep)]",
            )}
            onKeyDown={onKey}
          >
            <div className="flex items-center gap-3 px-4 h-14 border-b border-[var(--color-border)]">
              <Search className="size-[18px] text-white/45 shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar una conversación o ir a…"
                aria-label="Buscar"
                className="flex-1 bg-transparent outline-none text-[15px] text-white placeholder:text-white/35"
                autoComplete="off"
                spellCheck={false}
              />
              <kbd className="mono text-[10px] text-white/45 border border-white/10 rounded-md px-1.5 py-0.5">Esc</kbd>
            </div>

            <div ref={listRef} className="max-h-[52vh] overflow-y-auto py-2" role="listbox">
              {items.length === 0 && (
                <p className="px-4 py-6 text-[14px] text-white/50 text-center">
                  Nada coincide con «{query}».
                </p>
              )}
              {items.map((it, i) => (
                <div key={`${it.kind}-${it.id}`}>
                  {i === 0 && it.kind === "action" && (
                    <p className="mono text-[10px] uppercase tracking-[0.12em] text-white/40 px-4 pt-1 pb-1.5">Ir a</p>
                  )}
                  {i === firstConvIndex && (
                    <p className="mono text-[10px] uppercase tracking-[0.12em] text-white/40 px-4 pt-3 pb-1.5">
                      Conversaciones{query.trim() ? "" : " recientes"}
                    </p>
                  )}
                  <button
                    role="option"
                    aria-selected={i === cursor}
                    data-index={i}
                    onMouseEnter={() => setCursor(i)}
                    onClick={it.run}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 h-10 text-left transition-colors",
                      i === cursor ? "bg-white/[0.07] text-white" : "text-white/80 hover:bg-white/[0.04]",
                    )}
                  >
                    <span className={cn("shrink-0", i === cursor ? "text-[var(--color-noa)]" : "text-white/50")}>{it.icon}</span>
                    <span className="flex-1 min-w-0 truncate text-[14px]">{it.label}</span>
                    {it.hint && (
                      <span className="mono text-[11px] text-white/40 shrink-0 tabular-nums">{it.hint}</span>
                    )}
                    {i === cursor && <CornerDownLeft className="size-3.5 text-white/35 shrink-0" />}
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-4 px-4 h-9 border-t border-[var(--color-border)] mono text-[10px] text-white/40">
              <span><kbd className="text-white/60">↑↓</kbd> moverse</span>
              <span><kbd className="text-white/60">↵</kbd> abrir</span>
              <span><kbd className="text-white/60">{MOD_LABEL}K</kbd> buscar</span>
              <span><kbd className="text-white/60">/</kbd> escribirle a Noa</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
