import { lazy, Suspense, useEffect, useState } from "react";
import { AppBackground } from "./AppBackground";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { Sheet } from "@/components/ui/Sheet";
import { ChatSurface } from "@/components/chat/ChatSurface";
import { ChatInput } from "@/components/chat/ChatInput";
import { Sparkle } from "@/components/chat/Sparkle";
import { useRoute } from "@/hooks/useRoute";
import { useChat } from "@/hooks/useChat";
import { navigate } from "@/lib/routing";
import type { AuthUser } from "@/types/api";

const GalleryPage = lazy(() =>
  import("@/components/pages/GalleryPage").then((m) => ({ default: m.GalleryPage })),
);
const HistoryPage = lazy(() =>
  import("@/components/pages/HistoryPage").then((m) => ({ default: m.HistoryPage })),
);
const SettingsPage = lazy(() =>
  import("@/components/pages/SettingsPage").then((m) => ({ default: m.SettingsPage })),
);

function PageFallback() {
  return (
    <div className="h-full flex items-center justify-center">
      <Sparkle size={28} animate />
    </div>
  );
}

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
 *   │     ├─ ChatSurface (scrollable)      │
 *   │     └─ ChatInput (sticky bottom)     │
 *   └────────────────────────────────────────┘
 */
export function AppShell({ user, onLogout }: AppShellProps) {
  const route = useRoute();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const {
    conversations,
    activeId,
    setActiveId,
    messages,
    loading,
    loadingHint,
    streamingText,
    modelMode,
    setModelMode,
    sendMessage,
    stopGeneration,
    deleteConversation,
    refresh,
  } = useChat({
    userId: user.id,
    // P1-1 audit fix: sendMessage es dueño de crear la conv si no hay activa.
    // Esto evita el race entre pre-create en handleSend + useEffect[activeId]
    // que pisaba el userMsg optimista del primer mensaje.
    onConversationCreated: (id) => navigate({ kind: "chat", conversationId: id }),
  });

  // Sync activeId con la ruta URL
  useEffect(() => {
    if (route.kind === "chat") {
      if (route.conversationId && route.conversationId !== activeId) {
        setActiveId(route.conversationId);
      } else if (!route.conversationId && activeId !== null) {
        setActiveId(null);
      }
    }
  }, [route, activeId, setActiveId]);

  // Cierra drawer mobile al cambiar de ruta (incluido browser back/forward).
  // setState-in-effect es warning intencional acá: sincronizar UI con URL externo.
  useEffect(() => {
    setDrawerOpen(false);
  }, [route]);

  const handleNewChat = () => {
    setActiveId(null);
    navigate({ kind: "chat" });
  };

  const handleSelectConversation = (id: string) => {
    navigate({ kind: "chat", conversationId: id });
  };

  const handleSend = async (text: string, attachments?: import("@/components/chat/ChatInput").AttachedFile[]) => {
    // P1-1 audit fix: NO pre-creamos conversación acá. sendMessage la crea si
    // no hay activa y dispara onConversationCreated → navigate. Eso garantiza
    // que skipNextLoadRef se setee ANTES de que el useEffect[activeId] dispare.
    // Backend acepta 1 image_base64 + 1 file_base64. Multi-file iteramos (cada uno como msg propio).
    if (!attachments || attachments.length === 0) {
      await sendMessage(text);
      return;
    }
    // Primer attachment va con el texto. El resto como messages separados.
    const [first, ...rest] = attachments;
    const firstOpts =
      first.kind === "image"
        ? { image_base64: first.base64, image_mode: false }
        : { file_base64: first.base64, file_name: first.name, file_type: first.mime };
    await sendMessage(text, firstOpts as never);
    for (const att of rest) {
      const opts =
        att.kind === "image"
          ? { image_base64: att.base64, image_mode: false }
          : { file_base64: att.base64, file_name: att.name, file_type: att.mime };
      await sendMessage("", opts as never);
    }
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
          activeConversationId={activeId}
          onLogout={onLogout}
          onNewChat={handleNewChat}
          onSelectConversation={handleSelectConversation}
          onConversationsChanged={refresh}
        />

        {/* Mobile drawer */}
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen} side="left">
          <Sidebar
            isMobile
            user={user}
            route={route}
            conversations={conversations}
            activeConversationId={activeId}
            onLogout={onLogout}
            onNewChat={handleNewChat}
            onSelectConversation={handleSelectConversation}
            onConversationsChanged={refresh}
            onDeleteConversation={deleteConversation}
            onCloseMobile={() => setDrawerOpen(false)}
          />
        </Sheet>

        {/* Main column */}
        <div className="flex-1 flex flex-col min-w-0 h-full">
          <TopBar
            onMenu={() => setDrawerOpen(true)}
            onNewChat={handleNewChat}
            modelMode={modelMode}
            onModelModeChange={setModelMode}
          />

          <main className="flex-1 overflow-hidden min-h-0">
            {route.kind === "chat" && (
              <ChatSurface
                messages={messages}
                streamingText={streamingText}
                loading={loading}
                loadingHint={loadingHint}
                userName={user.name?.split(" ")[0]}
              />
            )}
            {route.kind === "galeria" && (
              <Suspense fallback={<PageFallback />}>
                <GalleryPage />
              </Suspense>
            )}
            {route.kind === "historial" && (
              <Suspense fallback={<PageFallback />}>
                <HistoryPage onDeleteConversation={deleteConversation} />
              </Suspense>
            )}
            {route.kind === "config" && (
              <Suspense fallback={<PageFallback />}>
                <SettingsPage user={user} tab={route.tab} onLogout={onLogout} />
              </Suspense>
            )}
          </main>

          {route.kind === "chat" && (
            <ChatInput
              onSend={handleSend}
              onStop={stopGeneration}
              loading={loading}
            />
          )}
        </div>
      </div>
    </>
  );
}

