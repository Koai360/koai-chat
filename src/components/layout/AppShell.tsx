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
import { FullSidebar } from "./FullSidebar";
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
import { Drawer, DrawerContent } from "@/components/ui/drawer";
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
    activeId,
    setActiveId,
    agent,
    setAgent,
    loading,
    loadingHint,
    streamingText,
    sendMessage,
    newConversation,
    deleteConversation,
    deleteMessages,
    moveToProject,
    renameConversation,
  } = useChat(user.id);

  const { notifications, unreadCount: _unreadCount, markRead, markAllRead, removeOne, removeAll } = useNotifications();
  const { currentPage, navigate } = useNavigation();
  const { theme, toggleTheme } = useTheme();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<PanelType>(null);
  const [modalImage, setModalImage] = useState<string | null>(null);
  const [swUpdate, setSwUpdate] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

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
  const handleNewConvo = useCallback(() => {
    newConversation();
    navigate("chat");
  }, [newConversation, navigate]);

  // Handle send from HomePage — create convo, send, navigate
  const handleHomeSend = useCallback((text: string) => {
    newConversation();
    navigate("chat");
    // Small delay to let the conversation be created
    setTimeout(() => sendMessage(text), 100);
  }, [newConversation, navigate, sendMessage]);

  const sidebarContent = (
    <FullSidebar
      conversations={conversations}
      activeId={activeId}
      onSelect={handleSelectConvo}
      onNew={handleNewConvo}
      onDelete={deleteConversation}
      onRename={renameConversation}
      onMoveToProject={moveToProject}
      onClose={() => setSidebarOpen(false)}
      user={user}
      onLogout={onLogout}
      currentPage={currentPage}
      onNavigate={navigate}
    />
  );

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
            onImageClick={setModalImage}
          />
        );
      case "chatHistory":
        return (
          <ChatHistoryPage
            conversations={conversations}
            onSelect={handleSelectConvo}
            onDelete={deleteConversation}
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
            onImageClick={setModalImage}
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

      <div className="h-full flex bg-bg text-text">
        {/* Desktop Icon Rail */}
        <IconRail
          currentPage={currentPage}
          onNavigate={navigate}
          user={user}
          onLogout={onLogout}
          agent={agent}
        />

        {/* Mobile sidebar drawer */}
        <Drawer open={sidebarOpen} onOpenChange={setSidebarOpen} direction="left">
          <DrawerContent
            className="h-full w-[min(280px,85vw)] rounded-none border-none bg-bg-sidebar"
            aria-describedby={undefined}
          >
            <span className="sr-only">Menú de navegación</span>
            {sidebarContent}
          </DrawerContent>
        </Drawer>

        {/* Main content */}
        <div className="flex-1 flex flex-col h-full min-w-0">
          <ContentTopBar
            agent={agent}
            onAgentChange={setAgent}
            agentDisabled={loading}
            onNewConversation={handleNewConvo}
            user={user}
            theme={theme}
            onToggleTheme={toggleTheme}
            onOpenSidebar={() => setSidebarOpen(true)}
          />

          <main className="flex-1 overflow-hidden pb-[60px] md:pb-0">
            {renderPage()}
          </main>
        </div>

        {/* Mobile Tab Bar */}
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
          <ImageViewer src={modalImage} onClose={() => setModalImage(null)} />
        )}

        {/* SW update banner */}
        {swUpdate && <UpdateBanner onUpdate={handleUpdate} />}

        {/* Push toast */}
        <PushToast />
      </div>
    </TooltipProvider>
  );
}
