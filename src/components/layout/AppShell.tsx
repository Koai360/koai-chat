import { useState, useEffect, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import type { AuthUser } from "@/hooks/useAuth";
import { useChat } from "@/hooks/useChat";
import { useNotifications } from "@/hooks/useNotifications";
import { useNavigation } from "@/hooks/useNavigation";
import { useTheme } from "@/hooks/useTheme";
import { transcribeAudio } from "@/lib/api";
import { requestPushPermission } from "@/lib/push";
import { IconRail } from "./IconRail";
import { ContentTopBar } from "./ContentTopBar";
import { MobileTabBar } from "./MobileTabBar";
import { ChatView } from "@/components/chat/ChatView";
import { HomePage } from "@/components/pages/HomePage";
import { ChatHistoryPage } from "@/components/pages/ChatHistoryPage";
import { ExplorePage } from "@/components/pages/ExplorePage";
import { MediaGalleryPage } from "@/components/pages/MediaGalleryPage";
import { SettingsPage } from "@/components/pages/SettingsPage";
import { ImageViewer } from "@/components/gallery/ImageViewer";
import { NotificationsPanel } from "@/components/panels/NotificationsPanel";
import { BriefsPanel } from "@/components/panels/BriefsPanel";
import { MemoryPanel } from "@/components/panels/MemoryPanel";
import { SystemStatusPanel } from "@/components/panels/SystemStatusPanel";
import { UpdateBanner } from "@/components/shared/UpdateBanner";
import { PushToast } from "@/components/shared/PushToast";
import { SplashScreen } from "@/components/shared/SplashScreen";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { TooltipProvider } from "@/components/ui/tooltip";

type PanelType = "notifications" | "briefs" | "memory" | "systemStatus" | null;

interface Props {
  user: AuthUser;
  onLogout: () => void;
}

export function AppShell({ user, onLogout }: Props) {
  const {
    conversations,
    active,
    setActiveId,
    agent,
    setAgent,
    thinkingLevel,
    setThinkingLevel,
    loading,
    loadingHint,
    streamingText,
    sendMessage,
    newConversation,
    deleteConversation,
    deleteMessages,
    renameConversation,
  } = useChat(user.id);

  const { notifications, unreadCount: _unreadCount, markRead, markAllRead, removeOne, removeAll } = useNotifications();
  const { currentPage, navigate } = useNavigation();
  const { theme, toggleTheme } = useTheme();

  const [activePanel, setActivePanel] = useState<PanelType>(null);
  const [modalImage, setModalImage] = useState<{ src: string; id?: string } | null>(null);
  const [swUpdate, setSwUpdate] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  // Handler de delete desde ImageViewer (delega al backend + dispatcha evento
  // para que MediaGalleryPage refresque su lista localmente)
  const handleViewerDelete = useCallback(async (imageId: string) => {
    const { deleteImage } = await import("@/lib/api");
    await deleteImage(imageId);
    // Notify MediaGalleryPage to remove this id from its state
    window.dispatchEvent(new CustomEvent("gallery-image-deleted", { detail: { id: imageId } }));
  }, []);

  // Splash screen — 2.2s
  useEffect(() => {
    const t = setTimeout(() => setShowSplash(false), 2200);
    return () => clearTimeout(t);
  }, []);

  // Push subscription
  useEffect(() => {
    const timer = setTimeout(() => requestPushPermission(), 2000);
    return () => clearTimeout(timer);
  }, []);

  // SW update listener
  useEffect(() => {
    const handler = () => setSwUpdate(true);
    window.addEventListener("sw-update-available", handler);
    return () => window.removeEventListener("sw-update-available", handler);
  }, []);

  const handleUpdate = () => {
    navigator.serviceWorker?.controller?.postMessage("SKIP_WAITING");
    window.location.reload();
  };

  // Navigate to chat when a conversation is selected
  const handleSelectConvo = useCallback((id: string) => {
    setActiveId(id);
    navigate("chat");
  }, [setActiveId, navigate]);

  // Create new conversation and go to chat
  const handleNewConvo = useCallback(async () => {
    // Si ya hay una convo activa pero está vacía, reusarla (evita spawn
    // de convos huérfanas). Solo aplica si estás EN el chat view.
    if (currentPage === "chat" && active && active.messages.length === 0) {
      return;
    }
    // Con optimistic update esto es instantáneo
    await newConversation();
    navigate("chat");
  }, [newConversation, navigate, currentPage, active]);

  // Handle send from HomePage — create convo, navigate to chat, send
  const handleHomeSend = useCallback(
    async (text: string, imageBase64?: string, imageMode?: boolean, imageEngine?: string) => {
      await newConversation();
      navigate("chat");
      sendMessage(text, imageBase64, imageMode, imageEngine);
    },
    [newConversation, navigate, sendMessage]
  );

  // Redirect a home si estás en "chat" sin convo activa
  // (side effect — NO en render, evita loop infinito)
  useEffect(() => {
    if (currentPage === "chat" && !active) {
      navigate("home");
    }
  }, [currentPage, active, navigate]);

  const renderPage = () => {
    switch (currentPage) {
      case "home":
        return (
          <HomePage
            userName={user.name}
            onSend={handleHomeSend}
            onNavigate={navigate}
          />
        );
      case "chat":
        // Si no hay convo activa en ruta "chat", renderizar null mientras
        // el useEffect de arriba redirige a home (NO llamar navigate aquí
        // porque setState durante el render causa loop infinito y crash)
        if (!active) {
          return null;
        }
        return (
          <ChatView
            conversation={active}
            agent={agent}
            loading={loading}
            loadingHint={loadingHint}
            streamingText={streamingText}
            onSend={sendMessage}
            onTranscribe={transcribeAudio}
            onDelete={deleteConversation}
            onDeleteMessages={deleteMessages}
            userName={user.name}
            onImageClick={(src) => setModalImage({ src })}
          />
        );
      case "chatHistory":
        return (
          <ChatHistoryPage
            conversations={conversations}
            onSelect={handleSelectConvo}
            onDelete={deleteConversation}
            onRename={renameConversation}
          />
        );
      case "explore":
        return (
          <ExplorePage
            onNavigate={navigate}
            onStartChat={handleHomeSend}
          />
        );
      case "media":
        return (
          <MediaGalleryPage
            onImageClick={(src, id) => setModalImage({ src, id })}
          />
        );
      case "settings":
        return (
          <SettingsPage
            user={user}
            onLogout={onLogout}
            theme={theme}
            onToggleTheme={toggleTheme}
          />
        );
      default:
        return null;
    }
  };

  return (
    <TooltipProvider delayDuration={0}>
      <AnimatePresence>
        {showSplash && <SplashScreen />}
      </AnimatePresence>

      <div className="fixed inset-0 flex flex-col bg-bg text-text overflow-hidden">
        {/* Grain overlay */}
        <div className="grain pointer-events-none fixed inset-0 z-[5]" />

        {/* Ambient orbs */}
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
          <div
            className="ambient-orb w-72 h-72 opacity-[0.05]"
            style={{
              background: "radial-gradient(circle, var(--color-kira) 0%, transparent 70%)",
              top: "-5%",
              right: "-10%",
              animation: "float 14s ease-in-out infinite",
            }}
          />
          <div
            className="ambient-orb w-96 h-96 opacity-[0.04]"
            style={{
              background: "radial-gradient(circle, var(--color-kronos) 0%, transparent 70%)",
              bottom: "-15%",
              left: "-10%",
              animation: "float 18s ease-in-out infinite 3s",
            }}
          />
          <div
            className="ambient-orb w-64 h-64 opacity-[0.03]"
            style={{
              background: "radial-gradient(circle, var(--color-kira) 0%, transparent 60%)",
              top: "40%",
              left: "50%",
              animation: "float 12s ease-in-out infinite 6s",
            }}
          />
        </div>

        {/* Row: IconRail (desktop) + Content column */}
        <div className="flex flex-1 min-h-0">
          {/* Desktop Icon Rail */}
          <IconRail
            currentPage={currentPage}
            onNavigate={navigate}
            user={user}
            onLogout={onLogout}
            agent={agent}
          />

          {/* Content column */}
          <div className="flex-1 flex flex-col min-w-0 min-h-0 relative z-10">
            <ContentTopBar
              agent={agent}
              onAgentChange={setAgent}
              agentDisabled={loading}
              thinkingLevel={thinkingLevel}
              onThinkingLevelChange={setThinkingLevel}
              onNewConversation={handleNewConvo}
              currentPage={currentPage}
              user={user}
              theme={theme}
              onToggleTheme={toggleTheme}
              onNavigate={navigate}
            />

            <main className="flex-1 overflow-y-auto min-h-0" style={{ WebkitOverflowScrolling: "touch" }}>
              {renderPage()}
            </main>
          </div>
        </div>

        {/* Bottom nav — flex-shrink-0, NEVER shrinks */}
        <MobileTabBar
          currentPage={currentPage}
          onNavigate={navigate}
        />

        {/* Right panels as Sheet */}
        <Sheet open={activePanel !== null} onOpenChange={(open) => !open && setActivePanel(null)}>
          <SheetContent side="right" className="w-[min(380px,92vw)] p-0 bg-bg-sidebar border-border">
            {activePanel === "notifications" && (
              <NotificationsPanel
                notifications={notifications}
                onMarkRead={markRead}
                onMarkAllRead={markAllRead}
                onDelete={removeOne}
                onDeleteAll={removeAll}
                onClose={() => setActivePanel(null)}
              />
            )}
            {activePanel === "briefs" && (
              <BriefsPanel onClose={() => setActivePanel(null)} />
            )}
            {activePanel === "memory" && (
              <MemoryPanel onClose={() => setActivePanel(null)} />
            )}
            {activePanel === "systemStatus" && (
              <SystemStatusPanel onClose={() => setActivePanel(null)} />
            )}
          </SheetContent>
        </Sheet>

        {/* Image viewer modal */}
        {modalImage && (
          <ImageViewer
            src={modalImage.src}
            imageId={modalImage.id}
            onDelete={modalImage.id ? handleViewerDelete : undefined}
            onClose={() => setModalImage(null)}
          />
        )}

        {/* SW update banner */}
        {swUpdate && <UpdateBanner onUpdate={handleUpdate} />}

        {/* Push toast */}
        <PushToast />
      </div>
    </TooltipProvider>
  );
}
