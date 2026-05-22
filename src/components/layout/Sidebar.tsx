import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Menu,
  Edit3,
  Image as ImageIcon,
  Clock,
  Settings,
  LogOut,
  User,
} from "lucide-react";
import { Sparkle } from "@/components/chat/Sparkle";
import { IconButton } from "@/components/ui/IconButton";
import { Dropdown, DropdownItem, DropdownSeparator } from "@/components/ui/Dropdown";
import { cn } from "@/lib/cn";
import type { AuthUser, Conversation } from "@/types/api";
import { navigate, type Route } from "@/lib/routing";

interface SidebarProps {
  user: AuthUser;
  route: Route;
  conversations: Conversation[];
  activeConversationId: string | null;
  onLogout: () => void;
  onNewChat: () => void;
  onSelectConversation: (id: string) => void;
  isMobile?: boolean;
  onCloseMobile?: () => void;
}

/**
 * Sidebar — collapsible 56px → 280px overlay desktop. Drawer en mobile.
 *
 * Reglas:
 * - Default desktop: 56px rail con solo iconos (☰, ✎, 👤)
 * - Click ☰ → expande a 280px en overlay (no squeeze del chat)
 * - Click fuera del expandido → collapsa
 * - Mobile (`isMobile=true`): siempre expandido (vive dentro de un Sheet drawer)
 */
export function Sidebar({
  user,
  route,
  conversations,
  activeConversationId,
  onLogout,
  onNewChat,
  onSelectConversation,
  isMobile = false,
  onCloseMobile,
}: SidebarProps) {
  const [expanded, setExpanded] = useState(false);
  const open = isMobile || expanded;

  // En mobile el sidebar siempre se renderiza expandido (lo controla el Sheet)
  // En desktop puede estar collapsed (56px) o expanded (overlay 280px)

  if (isMobile) {
    return (
      <SidebarContent
        user={user}
        route={route}
        conversations={conversations}
        activeConversationId={activeConversationId}
        onLogout={onLogout}
        onNewChat={() => {
          onNewChat();
          onCloseMobile?.();
        }}
        onSelectConversation={(id) => {
          onSelectConversation(id);
          onCloseMobile?.();
        }}
        onCollapse={onCloseMobile}
      />
    );
  }

  return (
    <>
      {/* Rail collapsed siempre presente (56px) */}
      <aside
        className={cn(
          "hidden md:flex flex-col items-center justify-between",
          "w-14 h-full shrink-0",
          "bg-[var(--color-bg-elevated)]/40 border-r border-[var(--color-border)]",
          "backdrop-blur-xl py-3 safe-top safe-bottom z-30 relative",
        )}
      >
        <div className="flex flex-col items-center gap-2">
          <IconButton
            icon={<Menu className="size-5" />}
            label={open ? "Cerrar menú" : "Abrir menú"}
            variant="ghost"
            size="md"
            onClick={() => setExpanded((v) => !v)}
            active={open}
          />
          <IconButton
            icon={<Edit3 className="size-5" />}
            label="Nuevo chat"
            variant="ghost"
            size="md"
            onClick={onNewChat}
          />
        </div>

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

      {/* Overlay expanded (280px) */}
      <AnimatePresence>
        {expanded && (
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
                onLogout={onLogout}
                onNewChat={() => {
                  onNewChat();
                  setExpanded(false);
                }}
                onSelectConversation={(id) => {
                  onSelectConversation(id);
                  setExpanded(false);
                }}
                onCollapse={() => setExpanded(false)}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

// ===================================================================
// Sidebar content — el contenido del sidebar expandido (compartido entre mobile drawer y desktop overlay)
// ===================================================================

interface SidebarContentProps {
  user: AuthUser;
  route: Route;
  conversations: Conversation[];
  activeConversationId: string | null;
  onLogout: () => void;
  onNewChat: () => void;
  onSelectConversation: (id: string) => void;
  onCollapse?: () => void;
}

function SidebarContent({
  user,
  route,
  conversations,
  activeConversationId,
  onLogout,
  onNewChat,
  onSelectConversation,
  onCollapse,
}: SidebarContentProps) {
  const recent = conversations.slice(0, 5);

  return (
    <div className="flex flex-col h-full safe-top safe-bottom">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-4">
        {onCollapse && (
          <IconButton
            icon={<Menu className="size-5" />}
            label="Colapsar menú"
            variant="ghost"
            size="md"
            onClick={onCollapse}
          />
        )}
        <Sparkle size={20} />
        <span className="display text-[16px] font-medium text-white">Noa</span>
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
          <Edit3 className="size-4" />
          Nuevo chat
        </button>
      </div>

      {/* Recientes */}
      <div className="flex-1 overflow-y-auto px-3 py-2 min-h-0">
        <p className="mono text-[10px] uppercase tracking-[0.12em] text-white/40 px-2.5 mb-2 font-medium">
          Recientes
        </p>
        <nav className="flex flex-col gap-0.5">
          {recent.length === 0 ? (
            <p className="text-xs text-white/30 px-2.5 py-2">Sin conversaciones aún</p>
          ) : (
            recent.map((c) => {
              const isActive = c.id === activeConversationId;
              const title = c.title || "Nueva conversación";
              return (
                <button
                  key={c.id}
                  onClick={() => onSelectConversation(c.id)}
                  className={cn(
                    "group w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left",
                    "transition-colors duration-150",
                    isActive
                      ? "bg-white/[0.08] text-white"
                      : "text-white/70 hover:bg-white/[0.04] hover:text-white",
                  )}
                >
                  {isActive && (
                    <span className="size-1.5 rounded-full bg-[var(--color-noa)] flex-shrink-0" />
                  )}
                  <span className="flex-1 text-sm truncate">{title}</span>
                </button>
              );
            })
          )}
          {conversations.length > 5 && (
            <button
              onClick={() => navigate({ kind: "historial" })}
              className="text-xs text-white/45 hover:text-white/80 px-2.5 py-1.5 text-left transition"
            >
              ver todas →
            </button>
          )}
        </nav>
      </div>

      {/* Footer utilities */}
      <div className="border-t border-[var(--color-border)] px-2 py-2">
        <FooterLink
          icon={<ImageIcon className="size-4" />}
          label="Galería"
          active={route.kind === "galeria"}
          onClick={() => navigate({ kind: "galeria" })}
        />
        <FooterLink
          icon={<Clock className="size-4" />}
          label="Historial"
          active={route.kind === "historial"}
          onClick={() => navigate({ kind: "historial" })}
        />
        <FooterLink
          icon={<Settings className="size-4" />}
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
                <div className="size-8 rounded-full bg-white/[0.08] flex items-center justify-center">
                  <User className="size-4 text-white/70" />
                </div>
              )}
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm text-white/95 truncate font-medium">{user.name}</p>
                <p className="mono text-[11px] text-white/40 truncate tracking-tight">{user.email}</p>
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
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition",
        active
          ? "bg-white/[0.06] text-white"
          : "text-white/70 hover:bg-white/[0.04] hover:text-white",
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
