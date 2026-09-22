import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  PanelLeft,
  PanelLeftClose,
  SquarePen,
  Image as ImageIcon,
  Clock,
  Inbox,
  Settings,
  LogOut,
  User,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { NoaWordmark } from "@/components/brand/NoaWordmark";
import { IconButton } from "@/components/ui/IconButton";
import { Dropdown, DropdownItem, DropdownSeparator } from "@/components/ui/Dropdown";
import { InlineConfirm, InlineRename } from "@/components/ui/InlineConfirm";
import { cn } from "@/lib/cn";
import type { AuthUser, Conversation } from "@/types/api";
import { navigate, type Route } from "@/lib/routing";
import { renameConversation as apiRenameConversation, deleteConversation as apiDeleteConversation, listInbox } from "@/lib/api";
import { openPalette, MOD_LABEL } from "@/hooks/useHotkeys";
import { Search } from "lucide-react";

/** Cuenta de dudas pendientes en la Bandeja para el badge del nav (poll 60s +
 *  refresco al navegar, ej. al salir de la Bandeja tras resolver). */
function useInboxCount(): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let alive = true;
    const refresh = () => {
      listInbox()
        .then((items) => { if (alive) setCount(items.length); })
        .catch(() => { /* silencioso: el badge no es crítico */ });
    };
    refresh();
    const t = setInterval(refresh, 60_000);
    window.addEventListener("noa:navigate", refresh);
    window.addEventListener("noa:inbox-changed", refresh);
    return () => {
      alive = false;
      clearInterval(t);
      window.removeEventListener("noa:navigate", refresh);
      window.removeEventListener("noa:inbox-changed", refresh);
    };
  }, []);
  return count;
}

/** S332: ≥1280px es escritorio "de verdad" — el sidebar expandido cabe al lado del chat
 *  (272 + 720 + aire) sin comprimir nada. Entre 768 y 1279 (tablet, ventana chica) se
 *  mantiene el rail con overlay. */
const XL_QUERY = "(min-width: 1280px)";
const PINNED_KEY = "noa.sidebar.pinned";

function useIsXL(): boolean {
  const [xl, setXL] = useState(() => typeof window !== "undefined" && window.matchMedia(XL_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(XL_QUERY);
    const update = () => setXL(mq.matches);
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return xl;
}

/** Preferencia por-navegador: anclado por defecto en escritorio; si la persona lo colapsa,
 *  se respeta hasta que lo vuelva a abrir. localStorage puede fallar (privado/bloqueado):
 *  el default sigue siendo "anclado". */
function usePinned(): [boolean, (v: boolean) => void] {
  const [pinned, setPinnedState] = useState<boolean>(() => {
    try {
      return localStorage.getItem(PINNED_KEY) !== "0";
    } catch {
      return true;
    }
  });
  const setPinned = (v: boolean) => {
    setPinnedState(v);
    try {
      localStorage.setItem(PINNED_KEY, v ? "1" : "0");
    } catch {
      /* preferencia no persistida: no es crítico */
    }
  };
  return [pinned, setPinned];
}

interface SidebarProps {
  user: AuthUser;
  route: Route;
  conversations: Conversation[];
  activeConversationId: string | null;
  onLogout: () => void;
  onNewChat: () => void;
  onSelectConversation: (id: string) => void;
  onConversationsChanged?: () => void;
  /**
   * P1-3 audit: borrar conv pasa por useChat.deleteConversation que limpia
   * activeId + messages si el chat borrado era el activo. Si NO se pasa,
   * cae a apiDeleteConversation raw (genera ghost state — solo legacy).
   */
  onDeleteConversation?: (id: string) => Promise<void>;
  isMobile?: boolean;
  onCloseMobile?: () => void;
}

/**
 * Sidebar — tres modos según el ancho (S332, rediseño de escritorio):
 *
 * - **≥1280px (xl), anclado** (default): panel de 272px EN FLUJO con labels, recientes,
 *   navegación y usuario. Empuja el contenido, no lo tapa. Se puede colapsar al rail.
 * - **≥768px (md) o xl colapsado**: rail de 60px. A diferencia del rail viejo (☰ ✎ 👤), este
 *   lleva SIEMPRE la navegación primaria (Bandeja con badge, Galería, Historial, Config):
 *   ir a la Bandeja ya no exige abrir el menú. ☰ abre el overlay de 280px (md) o re-ancla (xl).
 * - **Mobile** (`isMobile`): siempre expandido, vive dentro del Sheet drawer.
 */
export function Sidebar({
  user,
  route,
  conversations,
  activeConversationId,
  onLogout,
  onNewChat,
  onSelectConversation,
  onConversationsChanged,
  onDeleteConversation,
  isMobile = false,
  onCloseMobile,
}: SidebarProps) {
  const [expanded, setExpanded] = useState(false);
  const isXL = useIsXL();
  const [pinned, setPinned] = usePinned();
  const inboxCount = useInboxCount();
  const docked = isXL && pinned;
  const open = isMobile || docked || expanded;

  // P2-12 audit: cerrar overlay desktop con Escape (mobile usa Sheet de vaul
  // que ya tiene Escape). Listener global porque el motion.aside puede no
  // tener foco al abrir y el evento sube al document.
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [expanded]);

  if (isMobile) {
    return (
      <SidebarContent
        user={user}
        route={route}
        conversations={conversations}
        activeConversationId={activeConversationId}
        inboxCount={inboxCount}
        onLogout={onLogout}
        onNewChat={() => {
          onNewChat();
          onCloseMobile?.();
        }}
        onSelectConversation={(id) => {
          onSelectConversation(id);
          onCloseMobile?.();
        }}
        onConversationsChanged={onConversationsChanged}
        onDeleteConversation={onDeleteConversation}
        onCollapse={onCloseMobile}
      />
    );
  }

  // ── Escritorio anclado: panel en flujo ──
  if (docked) {
    return (
      <aside
        className={cn(
          "hidden md:flex flex-col shrink-0 h-full w-[272px] z-30 relative",
          "bg-[var(--color-bg-elevated)]/40 border-r border-[var(--color-border)] backdrop-blur-xl",
        )}
      >
        <SidebarContent
          user={user}
          route={route}
          conversations={conversations}
          activeConversationId={activeConversationId}
          inboxCount={inboxCount}
          recentLimit={18}
          onLogout={onLogout}
          onNewChat={onNewChat}
          onSelectConversation={onSelectConversation}
          onConversationsChanged={onConversationsChanged}
          onDeleteConversation={onDeleteConversation}
          onCollapse={() => setPinned(false)}
        />
      </aside>
    );
  }

  const toggle = () => {
    if (isXL) {
      setPinned(true);
    } else {
      setExpanded((v) => !v);
    }
  };

  return (
    <>
      {/* Rail (60px): toggle + nuevo chat arriba · navegación primaria en el medio · cuenta abajo */}
      <aside
        className={cn(
          "hidden md:flex flex-col items-center justify-between",
          "w-[60px] h-full shrink-0",
          "bg-[var(--color-bg-elevated)]/40 border-r border-[var(--color-border)]",
          "backdrop-blur-xl py-3 safe-top safe-bottom z-30 relative",
        )}
      >
        <div className="flex flex-col items-center gap-2">
          <IconButton
            icon={
              open ? (
                <PanelLeftClose className="size-[22px]" strokeWidth={2} />
              ) : (
                <PanelLeft className="size-[22px]" strokeWidth={2} />
              )
            }
            label={open ? "Cerrar menú" : isXL ? "Anclar menú" : "Abrir menú"}
            variant="ghost"
            size="lg"
            onClick={toggle}
            active={open}
          />
          <IconButton
            icon={<SquarePen className="size-[20px]" strokeWidth={2} />}
            label="Nuevo chat"
            variant="ghost"
            size="lg"
            onClick={onNewChat}
          />
          <IconButton
            icon={<Search className="size-[20px]" strokeWidth={2} />}
            label={`Buscar (${MOD_LABEL}K)`}
            variant="ghost"
            size="lg"
            onClick={openPalette}
          />
        </div>

        <nav aria-label="Secciones" className="flex flex-col items-center gap-1">
          <RailLink
            icon={<Inbox className="size-[20px]" strokeWidth={2} />}
            label="Bandeja"
            active={route.kind === "bandeja"}
            badge={inboxCount}
            onClick={() => navigate({ kind: "bandeja" })}
          />
          <RailLink
            icon={<ImageIcon className="size-[20px]" strokeWidth={2} />}
            label="Galería"
            active={route.kind === "galeria"}
            onClick={() => navigate({ kind: "galeria" })}
          />
          <RailLink
            icon={<Clock className="size-[20px]" strokeWidth={2} />}
            label="Historial"
            active={route.kind === "historial"}
            onClick={() => navigate({ kind: "historial" })}
          />
          <RailLink
            icon={<Settings className="size-[20px]" strokeWidth={2} />}
            label="Configuración"
            active={route.kind === "config"}
            onClick={() => navigate({ kind: "config" })}
          />
        </nav>

        <Dropdown
          trigger={
            <button
              aria-label="Cuenta"
              className="size-9 rounded-full overflow-hidden ring-1 ring-white/10 hover:ring-white/30 transition"
            >
              {user.picture ? (
                <img src={user.picture} alt={user.name} className="size-full object-cover" />
              ) : (
                <div className="size-full flex items-center justify-center bg-white/[0.08] text-white/80 text-sm font-medium">
                  {user.name?.[0]?.toUpperCase() ?? "U"}
                </div>
              )}
            </button>
          }
          align="end"
          side="right"
        >
          <div className="px-3 py-2 mb-1">
            <p className="text-sm text-white/95 font-medium truncate">{user.name}</p>
            <p className="text-xs text-white/45 truncate">{user.email}</p>
          </div>
          <DropdownSeparator />
          <DropdownItem
            icon={<Settings className="size-4" />}
            onClick={() => navigate({ kind: "config" })}
          >
            Configuración
          </DropdownItem>
          <DropdownSeparator />
          <DropdownItem
            icon={<LogOut className="size-4" />}
            variant="danger"
            onClick={onLogout}
          >
            Cerrar sesión
          </DropdownItem>
        </Dropdown>
      </aside>

      {/* Overlay expandido (280px) — sólo md..xl; en xl el toggle ancla el panel en flujo */}
      <AnimatePresence>
        {expanded && !isXL && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="hidden md:block fixed inset-0 z-30 bg-black/30"
              onClick={() => setExpanded(false)}
            />
            <motion.aside
              initial={{ x: -32, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -32, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 30 }}
              className={cn(
                "hidden md:flex flex-col",
                "fixed left-14 top-0 bottom-0 z-40",
                "w-[280px]",
                "bg-[var(--color-bg-elevated)] border-r border-[var(--color-border-hi)]",
                "backdrop-blur-xl shadow-[20px_0_60px_rgba(0,0,0,0.55)]",
              )}
            >
              <SidebarContent
                user={user}
                route={route}
                conversations={conversations}
                activeConversationId={activeConversationId}
                inboxCount={inboxCount}
                onLogout={onLogout}
                onNewChat={() => {
                  onNewChat();
                  setExpanded(false);
                }}
                onSelectConversation={(id) => {
                  onSelectConversation(id);
                  setExpanded(false);
                }}
                onConversationsChanged={onConversationsChanged}
                onDeleteConversation={onDeleteConversation}
                onCollapse={() => setExpanded(false)}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

/** Ícono de navegación en el rail, con badge de pendientes. El tooltip nativo (title) alcanza
 *  en escritorio: el label completo vive en el panel anclado. */
function RailLink({
  icon,
  label,
  active,
  badge,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={badge ? `${label} · ${badge} pendientes` : label}
      aria-current={active ? "page" : undefined}
      title={label}
      className={cn(
        "relative size-11 rounded-xl flex items-center justify-center transition-colors duration-150",
        active
          ? "bg-white/[0.08] text-white"
          : "text-white/60 hover:bg-white/[0.06] hover:text-white",
      )}
    >
      {icon}
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-[var(--color-noa)]" />
      )}
      {badge ? (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--color-noa)] text-black text-[10px] font-semibold leading-[18px] text-center tabular-nums">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </button>
  );
}

// ===================================================================
// Sidebar content — el contenido del sidebar expandido (mobile drawer, overlay y panel anclado)
// ===================================================================

interface SidebarContentProps {
  user: AuthUser;
  route: Route;
  conversations: Conversation[];
  activeConversationId: string | null;
  inboxCount: number;
  /** Cuántas recientes mostrar: 5 en overlay/drawer (poco alto útil), más en el panel anclado. */
  recentLimit?: number;
  onLogout: () => void;
  onNewChat: () => void;
  onSelectConversation: (id: string) => void;
  onConversationsChanged?: () => void;
  onDeleteConversation?: (id: string) => Promise<void>;
  onCollapse?: () => void;
}

function SidebarContent({
  user,
  route,
  conversations,
  activeConversationId,
  inboxCount,
  recentLimit = 5,
  onLogout,
  onNewChat,
  onSelectConversation,
  onConversationsChanged,
  onDeleteConversation,
  onCollapse,
}: SidebarContentProps) {
  const recent = conversations.slice(0, recentLimit);
  // S332: renombrar/borrar EN LA FILA (antes window.prompt/confirm/alert).
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleRename = async (conv: Conversation, next: string) => {
    setRenamingId(null);
    try {
      await apiRenameConversation(conv.id, next);
      onConversationsChanged?.();
    } catch (err) {
      console.warn("[Sidebar] rename failed", err);
      toast.error("No se pudo renombrar el chat.");
    }
  };

  const handleDelete = async (conv: Conversation) => {
    const wasActive = conv.id === activeConversationId;
    setBusyId(conv.id);
    try {
      // P1-3 audit fix: si está disponible, usar useChat.deleteConversation
      // que limpia activeId + messages cuando se borra la activa. Sino fallback
      // al raw API (legacy, deja ghost state).
      if (onDeleteConversation) {
        await onDeleteConversation(conv.id);
      } else {
        await apiDeleteConversation(conv.id);
        onConversationsChanged?.();
      }
      // S158-b: si se borró la conversación ACTIVA, sincronizar la URL a chat
      // vacío — sino el hash apunta a una conv inexistente
      if (wasActive) navigate({ kind: "chat" });
    } catch (err) {
      console.warn("[Sidebar] delete failed", err);
      toast.error("No se pudo borrar el chat.");
    } finally {
      setBusyId(null);
      setDeletingId(null);
    }
  };

  return (
    <div className="flex flex-col h-full safe-top safe-bottom">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-4">
        {onCollapse && (
          <IconButton
            icon={<PanelLeftClose className="size-5" />}
            label="Colapsar menú"
            variant="ghost"
            size="md"
            onClick={onCollapse}
          />
        )}
        <NoaWordmark height={22} />
      </div>

      {/* New chat */}
      <div className="px-3 pb-3">
        <button
          onClick={onNewChat}
          className={cn(
            "w-full flex items-center gap-2 px-3.5 h-11 rounded-full",
            "bg-white/[0.04] border border-white/[0.10]",
            "text-white text-sm font-medium",
            "transition-all duration-200 ease-out",
            "hover:bg-[var(--color-noa-soft)] hover:border-[var(--color-noa)]/40 hover:text-[var(--color-noa)]",
          )}
        >
          <SquarePen className="size-4" />
          <span className="flex-1 text-left">Nuevo chat</span>
          <kbd className="hidden xl:inline mono text-[10px] text-white/40 tracking-tight">{MOD_LABEL}⇧O</kbd>
        </button>
        {/* S332 F1: buscador ⌘K a la vista — el atajo se descubre leyéndolo acá */}
        <button
          onClick={openPalette}
          className={cn(
            "mt-2 w-full flex items-center gap-2 px-3.5 h-9 rounded-full",
            "text-white/55 text-[13px]",
            "hover:bg-white/[0.04] hover:text-white/85 transition-colors",
          )}
        >
          <Search className="size-4" />
          <span className="flex-1 text-left">Buscar…</span>
          <kbd className="mono text-[10px] text-white/40 tracking-tight">{MOD_LABEL}K</kbd>
        </button>
      </div>

      {/* Recientes */}
      <div className="flex-1 overflow-y-auto px-3 py-2 min-h-0">
        <p className="mono text-[10px] uppercase tracking-[0.12em] text-white/55 px-2.5 mb-2 font-medium">
          Recientes
        </p>
        <nav className="flex flex-col gap-0.5">
          {recent.length === 0 ? (
            <p className="text-xs text-white/55 px-2.5 py-2">Sin conversaciones aún</p>
          ) : (
            recent.map((c) => {
              const isActive = c.id === activeConversationId;
              const title = c.title || "Nueva conversación";
              if (deletingId === c.id) {
                return (
                  <InlineConfirm
                    key={c.id}
                    question={`¿Borrar «${title}»?`}
                    busy={busyId === c.id}
                    onConfirm={() => handleDelete(c)}
                    onCancel={() => setDeletingId(null)}
                  />
                );
              }
              if (renamingId === c.id) {
                return (
                  <InlineRename
                    key={c.id}
                    value={c.title || ""}
                    onSubmit={(next) => handleRename(c, next)}
                    onCancel={() => setRenamingId(null)}
                    className="px-1 py-1"
                  />
                );
              }
              return (
                <div
                  key={c.id}
                  className={cn(
                    "group w-full flex items-center gap-1 pl-2.5 pr-1 py-2 rounded-lg",
                    "transition-colors duration-150 min-h-[40px]",
                    isActive
                      ? "bg-white/[0.08] text-white"
                      : "text-white/70 hover:bg-white/[0.04] hover:text-white",
                  )}
                >
                  <button
                    onClick={() => onSelectConversation(c.id)}
                    className="flex-1 flex items-center gap-2 min-w-0 text-left"
                  >
                    {isActive && (
                      <span className="size-1.5 rounded-full bg-[var(--color-noa)] flex-shrink-0" />
                    )}
                    <span className="flex-1 text-sm truncate">{title}</span>
                  </button>
                  <Dropdown
                    align="end"
                    side="right"
                    trigger={
                      <button
                        aria-label="Opciones del chat"
                        className={cn(
                          // P2-16 audit: mobile siempre 44x44 (HIG). Desktop 28x28 ok
                          // porque solo aparece en hover y el target real es el row.
                          "shrink-0 size-7 md:size-7 [@media(pointer:coarse)]:size-11 rounded-md flex items-center justify-center",
                          "text-white/55 hover:text-white hover:bg-white/[0.08]",
                          "opacity-0 group-hover:opacity-100 focus:opacity-100",
                          "md:opacity-0 opacity-100",
                          "transition-opacity",
                        )}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="size-4" />
                      </button>
                    }
                  >
                    <DropdownItem
                      icon={<Pencil className="size-4" />}
                      onClick={() => setRenamingId(c.id)}
                    >
                      Renombrar
                    </DropdownItem>
                    <DropdownSeparator />
                    <DropdownItem
                      icon={<Trash2 className="size-4" />}
                      variant="danger"
                      onClick={() => setDeletingId(c.id)}
                    >
                      Borrar
                    </DropdownItem>
                  </Dropdown>
                </div>
              );
            })
          )}
          {conversations.length > recentLimit && (
            <button
              onClick={() => navigate({ kind: "historial" })}
              className="text-xs text-white/45 hover:text-white/80 px-2.5 py-1.5 text-left transition"
            >
              ver todas →
            </button>
          )}
        </nav>
      </div>

      {/* Footer utilities — touch targets generosos */}
      <div className="border-t border-[var(--color-border)] px-2 py-2 space-y-0.5">
        <FooterLink
          icon={<Inbox className="size-[18px]" />}
          label="Bandeja"
          active={route.kind === "bandeja"}
          badge={inboxCount}
          onClick={() => navigate({ kind: "bandeja" })}
        />
        <FooterLink
          icon={<ImageIcon className="size-[18px]" />}
          label="Galería"
          active={route.kind === "galeria"}
          onClick={() => navigate({ kind: "galeria" })}
        />
        <FooterLink
          icon={<Clock className="size-[18px]" />}
          label="Historial"
          active={route.kind === "historial"}
          onClick={() => navigate({ kind: "historial" })}
        />
        <FooterLink
          icon={<Settings className="size-[18px]" />}
          label="Configuración"
          active={route.kind === "config"}
          onClick={() => navigate({ kind: "config" })}
        />
      </div>

      {/* User chip */}
      <div className="border-t border-[var(--color-border)] p-3">
        <Dropdown
          trigger={
            <button className="w-full flex items-center gap-3 p-1.5 rounded-lg hover:bg-white/[0.04] transition">
              {user.picture ? (
                <img
                  src={user.picture}
                  alt={user.name}
                  className="size-8 rounded-full object-cover ring-1 ring-white/10"
                />
              ) : (
                <div className="size-8 rounded-full bg-white/[0.08] flex items-center justify-center ring-1 ring-white/10">
                  <User className="size-4 text-white/60" />
                </div>
              )}
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm text-white/95 truncate font-medium">{user.name}</p>
                <p className="mono text-[11px] text-white/55 truncate tracking-tight">{user.email}</p>
              </div>
            </button>
          }
          align="start"
          side="top"
        >
          <DropdownItem
            icon={<Settings className="size-4" />}
            onClick={() => navigate({ kind: "config" })}
          >
            Configuración
          </DropdownItem>
          <DropdownSeparator />
          <DropdownItem
            icon={<LogOut className="size-4" />}
            variant="danger"
            onClick={onLogout}
          >
            Cerrar sesión
          </DropdownItem>
        </Dropdown>
      </div>
    </div>
  );
}

function FooterLink({
  icon,
  label,
  active,
  badge,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "w-full flex items-center gap-3 px-3 min-h-[44px] rounded-lg text-sm transition-colors duration-150",
        active
          ? "bg-white/[0.08] text-white"
          : "text-white/65 hover:bg-white/[0.04] hover:text-white",
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {badge ? (
        <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[var(--color-noa)] text-black text-[11px] font-semibold leading-5 text-center tabular-nums">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </button>
  );
}
