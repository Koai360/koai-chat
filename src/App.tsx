import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth, type AuthUser } from "./hooks/useAuth";
import { useChat } from "./hooks/useChat";
import { transcribeAudio } from "./lib/api";
import { AgentToggle } from "./components/AgentToggle";
import { ChatView } from "./components/ChatView";
import { ConversationList } from "./components/ConversationList";
import { LoginScreen } from "./components/LoginScreen";
import { UpdateBanner } from "./components/UpdateBanner";
import { OnlineStatus } from "./components/OnlineStatus";

export default function App() {
  const auth = useAuth();

  if (auth.isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-gradient-to-b from-indigo-50 to-white dark:from-gray-900 dark:to-gray-950">
        <img src="/icons/koai-192.png" alt="KOAI" className="w-20 h-20 rounded-2xl animate-gentle-pulse shadow-lg" />
        <p className="mt-4 text-sm text-gray-400 animate-gentle-pulse">Cargando...</p>
      </div>
    );
  }

  if (!auth.isAuthenticated) {
    return <LoginScreen onLogin={auth.login} />;
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
    streamingText,
    sendMessage,
    newConversation,
    deleteConversation,
  } = useChat(user.id);

  const [showSidebar, setShowSidebar] = useState(false);
  const [swUpdate, setSwUpdate] = useState(false);

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

  useEffect(() => {
    const handler = () => setSwUpdate(true);
    window.addEventListener("sw-update-available", handler);
    return () => window.removeEventListener("sw-update-available", handler);
  }, []);

  const handleUpdate = () => {
    navigator.serviceWorker?.controller?.postMessage("SKIP_WAITING");
    window.location.reload();
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      {swUpdate && <UpdateBanner onUpdate={handleUpdate} />}

      {/* Header — iOS style with blur */}
      <header className="flex items-center justify-between px-2 py-1.5 bg-white/90 dark:bg-gray-950/90 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-800/50 safe-top">
        <button
          onClick={() => setShowSidebar(true)}
          className="w-11 h-11 flex items-center justify-center rounded-full active:bg-gray-100 dark:active:bg-gray-800 transition-colors active:scale-95"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        <div className="flex flex-col items-center">
          <AgentToggle agent={agent} onChange={setAgent} disabled={loading} />
          <OnlineStatus />
        </div>

        <button
          onClick={newConversation}
          className="w-11 h-11 flex items-center justify-center rounded-full active:bg-gray-100 dark:active:bg-gray-800 transition-colors active:scale-95"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      </header>

      {/* Chat area */}
      <main className="flex-1 overflow-hidden bg-white dark:bg-gray-950">
        <ChatView
          conversation={active}
          agent={agent}
          loading={loading}
          streamingText={streamingText}
          onSend={sendMessage}
          onTranscribe={transcribeAudio}
        />
      </main>

      {/* Sidebar overlay */}
      {showSidebar && (
        <>
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40 animate-fade-in"
            onClick={() => setShowSidebar(false)}
          />
          <div
            ref={sidebarRef}
            className="fixed inset-y-0 left-0 w-[min(300px,85vw)] z-50 shadow-2xl animate-slide-in"
            onTouchStart={handleSidebarTouchStart}
            onTouchMove={handleSidebarTouchMove}
            onTouchEnd={handleSidebarTouchEnd}
          >
            <ConversationList
              conversations={conversations}
              activeId={activeId}
              onSelect={setActiveId}
              onNew={newConversation}
              onDelete={deleteConversation}
              onClose={() => setShowSidebar(false)}
              user={user}
              onLogout={onLogout}
            />
          </div>
        </>
      )}
    </div>
  );
}
