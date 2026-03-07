import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth, type AuthUser } from "./hooks/useAuth";
import { useChat } from "./hooks/useChat";
import { useNotifications } from "./hooks/useNotifications";
import { transcribeAudio } from "./lib/api";
import { AgentToggle } from "./components/AgentToggle";
import { ChatView } from "./components/ChatView";
import { ConversationList } from "./components/ConversationList";
import { LoginScreen } from "./components/LoginScreen";
import { UpdateBanner } from "./components/UpdateBanner";
import { OnlineStatus } from "./components/OnlineStatus";
import { NotificationsPanel } from "./components/NotificationsPanel";
import { ImageGallery } from "./components/ImageGallery";
import { ImageViewer } from "./components/ImageViewer";
import { requestPushPermission } from "./lib/push";
import { PushToast } from "./components/PushToast";
import { BriefsPanel } from "./components/BriefsPanel";
import { SystemStatusWidget } from "./components/SystemStatusWidget";
import { MemoryPanel } from "./components/MemoryPanel";

export default function App() {
  const auth = useAuth();

  if (auth.isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-[#212121]">
        <img src="/icons/kira-logo.svg" alt="KOAI" className="w-20 h-20 rounded-2xl animate-gentle-pulse shadow-lg" />
        <p className="mt-4 text-sm text-[#9b9b9b] animate-gentle-pulse">Cargando...</p>
      </div>
    );
  }

  if (!auth.isAuthenticated) {
    return <LoginScreen onLogin={auth.login} onGoogleLogin={auth.loginWithGoogle} />;
  }

  return <ChatApp user={auth.user!} onLogout={auth.logout} />;
}

function ChatApp({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
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

  const [showSidebar, setShowSidebar] = useState(false);
  const [sidebarPinned, setSidebarPinned] = useState(() => {
    if (typeof window !== "undefined" && window.innerWidth >= 768) {
      return localStorage.getItem("koai-sidebar-pinned") === "true";
    }
    return false;
  });
  const [showNotifications, setShowNotifications] = useState(false);
  const [showBriefs, setShowBriefs] = useState(false);
  const [showMemory, setShowMemory] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [modalImage, setModalImage] = useState<string | null>(null);
  const [swUpdate, setSwUpdate] = useState(false);

  const isDesktop = typeof window !== "undefined" && window.innerWidth >= 768;

  // Sidebar swipe-to-close
  const sidebarRef = useRef<HTMLDivElement>(null);
  const sidebarTouchStartX = useRef(0);
  const sidebarTranslateX = useRef(0);

  const handleSidebarTouchStart = useCallback((e: React.TouchEvent) => {
    sidebarTouchStartX.current = e.touches[0].clientX;
    sidebarTranslateX.current = 0;
  }, []);

  const handleSidebarTouchMove = useCallback((e: React.TouchEvent) => {
    const diff = sidebarTouchStartX.current - e.touches[0].clientX;
    if (diff > 0 && sidebarRef.current) {
      sidebarTranslateX.current = diff;
      sidebarRef.current.style.transform = `translateX(-${diff}px)`;
    }
  }, []);

  const handleSidebarTouchEnd = useCallback(() => {
    if (sidebarTranslateX.current > 80) {
      setShowSidebar(false);
    }
    if (sidebarRef.current) {
      sidebarRef.current.style.transform = "";
    }
    sidebarTranslateX.current = 0;
  }, []);

  // Siempre sincronizar push subscription al abrir (Apple cambia endpoint cada sesión)
  useEffect(() => {
    const timer = setTimeout(() => requestPushPermission(), 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handler = () => setSwUpdate(true);
    window.addEventListener("sw-update-available", handler);
    return () => window.removeEventListener("sw-update-available", handler);
  }, []);

  const handleUpdate = () => {
    navigator.serviceWorker?.controller?.postMessage("SKIP_WAITING");
    window.location.reload();
  };

  const togglePin = useCallback(() => {
    setSidebarPinned((prev) => {
      const next = !prev;
      localStorage.setItem("koai-sidebar-pinned", String(next));
      return next;
    });
  }, []);

  const handleSelectConvo = useCallback((id: string) => {
    setActiveId(id);
    if (!sidebarPinned) setShowSidebar(false);
  }, [setActiveId, sidebarPinned]);

  const handleNewConvo = useCallback(() => {
    newConversation();
    if (!sidebarPinned) setShowSidebar(false);
  }, [newConversation, sidebarPinned]);

  return (
    <div className="h-full flex bg-[#212121] text-[#ececec]">
      {/* Pinned sidebar (desktop) */}
      {sidebarPinned && (
        <div className="hidden md:flex w-[300px] flex-shrink-0 border-r border-white/[0.06] h-full">
          <ConversationList
            conversations={conversations}
            activeId={activeId}
            onSelect={handleSelectConvo}
            onNew={handleNewConvo}
            onDelete={deleteConversation}
            onMoveToProject={moveToProject}
            onClose={() => setSidebarPinned(false)}
            onTogglePin={togglePin}
            isPinned={sidebarPinned}
            user={user}
            onLogout={onLogout}
            onOpenGallery={() => setShowGallery(true)}
          />
        </div>
      )}

      {/* Main content area */}
      {/* Update banner — flotante abajo */}
      {swUpdate && <UpdateBanner onUpdate={handleUpdate} />}

      <div className="flex-1 flex flex-col h-full min-w-0">
        {/* Header — neutral dark */}
        <header className="flex items-center justify-between px-2 py-1.5 safe-top bg-[#212121] border-b border-white/[0.06]">
          <button
            onClick={() => {
              if (isDesktop) { togglePin(); }
              else { setShowSidebar(true); }
            }}
            className="w-11 h-11 flex items-center justify-center rounded-full text-[#9b9b9b] hover:text-[#ececec] active:bg-white/5 transition-colors active:scale-95"
          >
            {sidebarPinned ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            )}
          </button>

          <div className="flex flex-col items-center">
            <AgentToggle agent={agent} onChange={setAgent} disabled={loading} />
            <div className="flex items-center gap-2">
              <OnlineStatus />
              <SystemStatusWidget />
            </div>
          </div>

          <div className="flex items-center">
            {/* Briefs button */}
            <button
              onClick={() => setShowBriefs(true)}
              className="w-11 h-11 flex items-center justify-center rounded-full text-[#9b9b9b] hover:text-[#ececec] active:bg-white/5 transition-colors active:scale-95"
              title="Briefs"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </button>
            {/* Memory button */}
            <button
              onClick={() => setShowMemory(true)}
              className="w-11 h-11 flex items-center justify-center rounded-full text-[#9b9b9b] hover:text-[#ececec] active:bg-white/5 transition-colors active:scale-95"
              title="Memoria"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4" />
                <path d="M12 8h.01" />
              </svg>
            </button>
            <button
              onClick={() => setShowNotifications(true)}
              className="relative w-11 h-11 flex items-center justify-center rounded-full text-[#9b9b9b] hover:text-[#ececec] active:bg-white/5 transition-colors active:scale-95"
            >
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            <button
              onClick={newConversation}
              className="w-11 h-11 flex items-center justify-center rounded-full text-[#9b9b9b] hover:text-[#ececec] active:bg-white/5 transition-colors active:scale-95"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </button>
          </div>
        </header>

        {/* Chat area or Gallery */}
        <main className="flex-1 overflow-hidden bg-[#212121]">
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

      {/* Mobile sidebar overlay */}
      {showSidebar && !sidebarPinned && (
        <>
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[60] animate-fade-in"
            onClick={() => setShowSidebar(false)}
          />
          <div
            ref={sidebarRef}
            className="fixed inset-y-0 left-0 w-[min(300px,85vw)] z-[70] shadow-2xl animate-slide-in"
            onTouchStart={handleSidebarTouchStart}
            onTouchMove={handleSidebarTouchMove}
            onTouchEnd={handleSidebarTouchEnd}
          >
            <ConversationList
              conversations={conversations}
              activeId={activeId}
              onSelect={handleSelectConvo}
              onNew={handleNewConvo}
              onDelete={deleteConversation}
              onMoveToProject={moveToProject}
              onClose={() => setShowSidebar(false)}
              user={user}
              onLogout={onLogout}
              onOpenGallery={() => { setShowSidebar(false); setShowGallery(true); }}
            />
          </div>
        </>
      )}

      {/* Notifications panel overlay */}
      {showNotifications && (
        <>
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[60] animate-fade-in"
            onClick={() => setShowNotifications(false)}
          />
          <div className="fixed inset-y-0 right-0 w-[min(340px,90vw)] z-[70] shadow-2xl animate-slide-in-right">
            <NotificationsPanel
              notifications={notifications}
              onMarkRead={markRead}
              onMarkAllRead={markAllRead}
              onDelete={removeOne}
              onDeleteAll={removeAll}
              onClose={() => setShowNotifications(false)}
            />
          </div>
        </>
      )}

      {/* Briefs panel overlay */}
      {showBriefs && (
        <>
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[60] animate-fade-in"
            onClick={() => setShowBriefs(false)}
          />
          <div className="fixed inset-y-0 right-0 w-[min(380px,92vw)] z-[70] shadow-2xl animate-slide-in-right">
            <BriefsPanel onClose={() => setShowBriefs(false)} />
          </div>
        </>
      )}

      {/* Memory panel overlay */}
      {showMemory && (
        <>
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[60] animate-fade-in"
            onClick={() => setShowMemory(false)}
          />
          <div className="fixed inset-y-0 right-0 w-[min(380px,92vw)] z-[70] shadow-2xl animate-slide-in-right">
            <MemoryPanel onClose={() => setShowMemory(false)} />
          </div>
        </>
      )}

      {/* Image modal */}
      {modalImage && (
        <ImageViewer src={modalImage} onClose={() => setModalImage(null)} />
      )}

      {/* Push toast in-app (foreground notifications) */}
      <PushToast />
    </div>
  );
}
