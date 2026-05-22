import { useEffect, useState } from "react";
import { AppBackground } from "./AppBackground";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { Sheet } from "@/components/ui/Sheet";
import { ChatEmpty } from "@/components/chat/ChatEmpty";
import { ChatInput } from "@/components/chat/ChatInput";
import { useRoute } from "@/hooks/useRoute";
import { navigate } from "@/lib/routing";
import type { AuthUser, Conversation } from "@/types/api";

interface AppShellProps {
  user: AuthUser;
  onLogout: () => void;
}

/**
 * AppShell — layout root con sidebar + main + bg.
 *
 * Estructura:
 *   ┌─ AppBackground (z=-1) ────────────────┐
 *   │  ┌─ Sidebar (desktop rail+overlay) ─┐ │
 *   │  └─ Main column ───────────────────┘ │
 *   │     ├─ TopBar (mobile only)          │
 *   │     ├─ Page content (chat/galeria/…) │
 *   │     └─ ChatInput (sticky bottom)     │
 *   └────────────────────────────────────────┘
 *
 * Mobile sidebar = Sheet drawer desde izquierda.
 */
export function AppShell({ user, onLogout }: AppShellProps) {
  const route = useRoute();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Placeholders Fase 2 — Fase 3 los llenará useChat real
  const [conversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  // Cuando hash cambia, cierra drawer mobile
  useEffect(() => {
    setDrawerOpen(false);
  }, [route]);

  const handleNewChat = () => {
    setActiveConversationId(null);
    navigate({ kind: "chat" });
  };

  const handleSelectConversation = (id: string) => {
    setActiveConversationId(id);
    navigate({ kind: "chat", conversationId: id });
  };

  const handleSend = (text: string) => {
    // En Fase 3 esto invoca useChat.sendMessage
    console.log("[AppShell] send placeholder:", text);
  };

  return (
    <>
      <AppBackground />

      <div className="relative z-10 flex h-full">
        {/* Desktop sidebar */}
        <Sidebar
          user={user}
          route={route}
          conversations={conversations}
          activeConversationId={activeConversationId}
          onLogout={onLogout}
          onNewChat={handleNewChat}
          onSelectConversation={handleSelectConversation}
        />

        {/* Mobile drawer */}
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen} side="left">
          <Sidebar
            isMobile
            user={user}
            route={route}
            conversations={conversations}
            activeConversationId={activeConversationId}
            onLogout={onLogout}
            onNewChat={handleNewChat}
            onSelectConversation={handleSelectConversation}
            onCloseMobile={() => setDrawerOpen(false)}
          />
        </Sheet>

        {/* Main column */}
        <div className="flex-1 flex flex-col min-w-0 h-full">
          <TopBar onMenu={() => setDrawerOpen(true)} onNewChat={handleNewChat} />

          <main className="flex-1 overflow-y-auto min-h-0">
            {route.kind === "chat" && <ChatEmpty userName={user.name?.split(" ")[0]} />}
            {route.kind === "galeria" && <PlaceholderPage title="Galería" subtitle="Fase 5" />}
            {route.kind === "historial" && (
              <PlaceholderPage title="Historial" subtitle="Fase 5" />
            )}
            {route.kind === "config" && (
              <PlaceholderPage title="Configuración" subtitle="Fase 5" />
            )}
          </main>

          {/* Input sticky bottom — solo visible en chat */}
          {route.kind === "chat" && <ChatInput onSend={handleSend} />}
        </div>
      </div>
    </>
  );
}

function PlaceholderPage({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6">
      <h1 className="display text-2xl text-white/90 mb-2">{title}</h1>
      {subtitle && <p className="text-sm text-white/40">{subtitle}</p>}
    </div>
  );
}
