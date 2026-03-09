import { useState, useEffect, useCallback } from "react";
import type { AuthUser } from "@/hooks/useAuth";
import { useChat } from "@/hooks/useChat";
import { useNotifications } from "@/hooks/useNotifications";
import { transcribeAudio } from "@/lib/api";
import { requestPushPermission } from "@/lib/push";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { ChatView } from "@/components/chat/ChatView";
import { ImageGallery } from "@/components/gallery/ImageGallery";
import { ImageViewer } from "@/components/gallery/ImageViewer";
import { NotificationsPanel } from "@/components/panels/NotificationsPanel";
import { BriefsPanel } from "@/components/panels/BriefsPanel";
import { MemoryPanel } from "@/components/panels/MemoryPanel";
import { SystemStatusPanel } from "@/components/panels/SystemStatusPanel";
import { UpdateBanner } from "@/components/shared/UpdateBanner";
import { PushToast } from "@/components/shared/PushToast";
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
  } = useChat(user.id);

  const { notifications, unreadCount, markRead, markAllRead, removeOne, removeAll } = useNotifications();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarPinned, setSidebarPinned] = useState(() => {
    if (typeof window !== "undefined" && window.innerWidth >= 768) {
      return localStorage.getItem("koai-sidebar-pinned") === "true";
    }
    return false;
  });
  const [activePanel, setActivePanel] = useState<PanelType>(null);
  const [showGallery, setShowGallery] = useState(false);
  const [modalImage, setModalImage] = useState<string | null>(null);
  const [swUpdate, setSwUpdate] = useState(false);

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

  const toggleSidebar = useCallback(() => {
    const desktop = window.innerWidth >= 768;
    if (desktop) {
      setSidebarPinned((prev) => {
        const next = !prev;
        localStorage.setItem("koai-sidebar-pinned", String(next));
        return next;
      });
    } else {
      setSidebarOpen(true);
    }
  }, []);

  const handleSelectConvo = useCallback((id: string) => {
    setActiveId(id);
    if (!sidebarPinned) setSidebarOpen(false);
  }, [setActiveId, sidebarPinned]);

  const handleNewConvo = useCallback(() => {
    newConversation();
    if (!sidebarPinned) setSidebarOpen(false);
  }, [newConversation, sidebarPinned]);

  const sidebarContent = (
    <Sidebar
      conversations={conversations}
      activeId={activeId}
      onSelect={handleSelectConvo}
      onNew={handleNewConvo}
      onDelete={deleteConversation}
      onMoveToProject={moveToProject}
      onClose={() => {
        setSidebarOpen(false);
        if (sidebarPinned) {
          setSidebarPinned(false);
          localStorage.setItem("koai-sidebar-pinned", "false");
        }
      }}
      user={user}
      onLogout={onLogout}
    />
  );

  return (
    <TooltipProvider delayDuration={0}>
      <div className="h-full flex bg-bg text-text">
        {/* Desktop pinned sidebar */}
        {sidebarPinned && (
          <div className="hidden md:flex w-[260px] flex-shrink-0 border-r border-border-subtle h-full">
            {sidebarContent}
          </div>
        )}

        {/* Mobile sidebar drawer */}
        <Drawer open={sidebarOpen && !sidebarPinned} onOpenChange={setSidebarOpen} direction="left">
          <DrawerContent className="h-full w-[min(280px,85vw)] rounded-none border-none bg-bg-sidebar" aria-describedby={undefined}>
            <span className="sr-only">Menú de navegación</span>
            {sidebarContent}
          </DrawerContent>
        </Drawer>

        {/* Main content */}
        <div className="flex-1 flex flex-col h-full min-w-0">
          <Header
            agent={agent}
            onAgentChange={setAgent}
            agentDisabled={loading}
            sidebarPinned={sidebarPinned}
            onToggleSidebar={toggleSidebar}
            onNewConversation={() => newConversation()}
            unreadCount={unreadCount}
            onOpenNotifications={() => setActivePanel("notifications")}
            onOpenBriefs={() => setActivePanel("briefs")}
            onOpenMemory={() => setActivePanel("memory")}
            onOpenSystemStatus={() => setActivePanel("systemStatus")}
            onOpenGallery={() => setShowGallery(true)}
            onLogout={onLogout}
          />

          <main className="flex-1 overflow-hidden bg-bg">
            {showGallery ? (
              <ImageGallery
                onClose={() => setShowGallery(false)}
                onImageClick={setModalImage}
              />
            ) : (
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
            )}
          </main>
        </div>

        {/* Right panels as Sheet */}
        <Sheet open={activePanel !== null} onOpenChange={(open) => !open && setActivePanel(null)}>
          <SheetContent side="right" className="w-[min(380px,92vw)] p-0 bg-bg-sidebar border-border-subtle">
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
