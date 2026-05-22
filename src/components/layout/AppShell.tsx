import { useEffect, useState } from "react";
import { AppBackground } from "./AppBackground";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { Sheet } from "@/components/ui/Sheet";
import { ChatSurface } from "@/components/chat/ChatSurface";
import { ChatInput } from "@/components/chat/ChatInput";
import { GalleryPage } from "@/components/pages/GalleryPage";
import { HistoryPage } from "@/components/pages/HistoryPage";
import { SettingsPage } from "@/components/pages/SettingsPage";
import { VoiceModal } from "@/components/voice/VoiceModal";
import { useRoute } from "@/hooks/useRoute";
import { useChat } from "@/hooks/useChat";
import { navigate } from "@/lib/routing";
import type { AuthUser } from "@/types/api";

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
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);

  const {
    conversations,
    activeId,
    setActiveId,
    messages,
    loading,
    loadingHint,
    streamingText,
    sendMessage,
    stopGeneration,
    newConversation,
  } = useChat(user.id);

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

  // Cierra drawer mobile al cambiar de ruta
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

  const handleSend = async (text: string) => {
    // Si no hay conversación activa, sendMessage crea una y nos lleva ahí
    if (!activeId) {
      const conv = await newConversation();
      navigate({ kind: "chat", conversationId: conv.id });
    }
    await sendMessage(text);
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
            onCloseMobile={() => setDrawerOpen(false)}
          />
        </Sheet>

        {/* Main column */}
        <div className="flex-1 flex flex-col min-w-0 h-full">
          <TopBar onMenu={() => setDrawerOpen(true)} onNewChat={handleNewChat} />

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
            {route.kind === "galeria" && <GalleryPage />}
            {route.kind === "historial" && <HistoryPage />}
            {route.kind === "config" && (
              <SettingsPage user={user} tab={route.tab} onLogout={onLogout} />
            )}
          </main>

          {route.kind === "chat" && (
            <ChatInput
              onSend={handleSend}
              onStop={stopGeneration}
              onVoiceTap={() => setVoiceModalOpen(true)}
              loading={loading}
            />
          )}
        </div>
      </div>

      <VoiceModal
        open={voiceModalOpen}
        onClose={() => setVoiceModalOpen(false)}
        onTranscript={(text) => {
          handleSend(text);
        }}
      />
    </>
  );
}

