import { useState, useEffect, useCallback, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import type { AuthUser } from "@/hooks/useAuth";
import { useChat } from "@/hooks/useChat";
import { useNotifications } from "@/hooks/useNotifications";
import { useNavigation } from "@/hooks/useNavigation";
import { useTheme } from "@/hooks/useTheme";
import { usePrivateMode } from "@/hooks/usePrivateMode";
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
import { NotesPage } from "@/components/pages/NotesPage";
import { DashboardPage } from "@/components/pages/DashboardPage";
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
import { ToastProvider } from "@/components/ui/toast";

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
    stopGeneration,
    newConversation,
    deleteConversation,
    deleteMessages,
    renameConversation,
    lastGeneratedImage,
    memoryUsage,
  } = useChat(user.id);

  const { notifications, unreadCount, markRead, markAllRead, removeOne, removeAll } = useNotifications();
  const { currentPage, navigate } = useNavigation();
  const { theme, toggleTheme } = useTheme();
  const { isUnlocked: isPrivateUnlocked } = usePrivateMode();

  const [activePanel, setActivePanel] = useState<PanelType>(null);
  const [modalImage, setModalImage] = useState<{ src: string; id?: string; isHidden?: boolean; rating?: 0 | 1 | 2 | 3 | 4 | 5 } | null>(null);
  // Cache de ratings — se pre-carga del backend al montar y se actualiza en cada rate
  const ratingsCache = useRef<Map<string, 0 | 1 | 2 | 3 | 4 | 5>>(new Map());
  const ratingsCacheLoaded = useRef(false);
  // editSourceUrl: URL de imagen R2 que el usuario pidió editar (desde chat o galería).
  // Se pasa a ChatView → ChatInput, que abre el modo edit automático y envía vía image_url.
  const [editSourceUrl, setEditSourceUrl] = useState<string | null>(null);
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

  // Handler de edit desde ImageViewer o MessageBubble:
  //   1. Guarda la URL R2 del original (para enviarla al backend)
  //   2. Cierra el viewer si estaba abierto
  //   3. Navega al chat (si veníamos de la galería)
  //   4. ChatView recibe editSourceUrl como prop y abre el modo edit automático
  const handleEditImage = useCallback((imageUrl: string) => {
    setEditSourceUrl(imageUrl);
    setModalImage(null);
    if (currentPage !== "chat") {
      navigate("chat");
    }
  }, [currentPage, navigate]);

  const handleAnimateImage = useCallback((imageUrl: string) => {
    setModalImage(null);
    if (currentPage !== "chat") {
      navigate("chat");
    }
    // Enviar mensaje automático pidiendo animación con la URL de la imagen
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("trigger-animate", { detail: { url: imageUrl } }));
    }, 100);
  }, [currentPage, navigate]);

  // Escuchar trigger-edit desde ChatInput (botón "Editar última imagen")
  useEffect(() => {
    const handler = (e: Event) => {
      const url = (e as CustomEvent<{ url: string }>).detail?.url;
      if (url) handleEditImage(url);
    };
    window.addEventListener("trigger-edit", handler);
    return () => window.removeEventListener("trigger-edit", handler);
  }, [handleEditImage]);

  // Pre-cargar ratings del backend al montar (una sola vez)
  useEffect(() => {
    if (ratingsCacheLoaded.current) return;
    ratingsCacheLoaded.current = true;
    import("@/lib/api").then(({ fetchRatingsMap }) => {
      fetchRatingsMap().then((map) => {
        for (const [id, rating] of Object.entries(map)) {
          ratingsCache.current.set(id, rating as 0 | 1 | 2 | 3 | 4 | 5);
        }
        if (Object.keys(map).length > 0) {
          console.log(`[AppShell] Pre-loaded ${Object.keys(map).length} ratings`);
        }
      });
    });
  }, []);

  const clearEditSource = useCallback(() => setEditSourceUrl(null), []);

  // Handler de hide/show desde ImageViewer (galería privada)
  const handleViewerHide = useCallback(async (imageId: string, hidden: boolean) => {
    const { hideImage } = await import("@/lib/api");
    await hideImage(imageId, hidden);
    window.dispatchEvent(new CustomEvent("gallery-image-hidden", { detail: { id: imageId, hidden } }));
  }, []);

  // Handler de star rating — sistema de style preference (1-5 estrellas)
  const handleViewerRate = useCallback(async (imageId: string, rating: 0 | 1 | 2 | 3 | 4 | 5) => {
    const { likeImage, unlikeImage } = await import("@/lib/api");
    if (rating === 0) {
      await unlikeImage(imageId);
    } else {
      await likeImage(imageId, rating);
    }
    // Guardar en cache local para que se muestre al re-abrir la imagen
    ratingsCache.current.set(imageId, rating);
    // Actualizar el modalImage actual para reflejar el cambio inmediato
    setModalImage((prev) => prev?.id === imageId ? { ...prev, rating } : prev);
    // Notificar a SettingsPage u otros listeners del count
    window.dispatchEvent(
      new CustomEvent("image-rated", { detail: { id: imageId, rating } }),
    );
  }, []);

  // Splash screen — 1.4s primer load, 600ms en cargas subsecuentes.
  // Respeta prefers-reduced-motion: salta el splash por completo.
  useEffect(() => {
    const reduced = typeof window !== "undefined"
      && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setShowSplash(false);
      return;
    }
    const seen = typeof localStorage !== "undefined" && localStorage.getItem("noa_splash_seen");
    const duration = seen ? 600 : 1400;
    const t = setTimeout(() => {
      setShowSplash(false);
      try { localStorage.setItem("noa_splash_seen", "1"); } catch { /* noop */ }
    }, duration);
    return () => clearTimeout(t);
  }, []);

  // Pausar ambient orbs cuando la pestaña/PWA está en background
  // (setea html[data-page-hidden=true] → CSS pausa animation)
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === "hidden") {
        document.documentElement.dataset.pageHidden = "true";
      } else {
        delete document.documentElement.dataset.pageHidden;
      }
    };
    document.addEventListener("visibilitychange", handler);
    handler();
    return () => {
      document.removeEventListener("visibilitychange", handler);
      delete document.documentElement.dataset.pageHidden;
    };
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
    async (text: string, imageBase64?: string, imageMode?: boolean, imageEngine?: string, editMode?: boolean, imageUrl?: string) => {
      await newConversation();
      navigate("chat");
      sendMessage(text, imageBase64, imageMode, imageEngine, editMode, imageUrl);
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
            onStop={stopGeneration}
            onTranscribe={transcribeAudio}
            onDelete={deleteConversation}
            onDeleteMessages={deleteMessages}
            userName={user.name}
            onImageClick={(src, messageId) => setModalImage({ src, id: messageId, rating: messageId ? ratingsCache.current.get(messageId) : undefined })}
            onEditImage={handleEditImage}
            onAnimateImage={handleAnimateImage}
            editSourceUrl={editSourceUrl}
            onClearEditSource={clearEditSource}
            lastGeneratedImage={lastGeneratedImage}
            memoryUsage={memoryUsage}
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
            onImageClick={(src, id, isHidden) => setModalImage({ src, id, isHidden, rating: id ? ratingsCache.current.get(id) : undefined })}
            isPrivateUnlocked={isPrivateUnlocked}
          />
        );
      case "notes":
        return <NotesPage />;
      case "dashboard":
        return <DashboardPage />;
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
    <ToastProvider>
    <TooltipProvider delayDuration={0}>
      <AnimatePresence>
        {showSplash && <SplashScreen />}
      </AnimatePresence>

      <div className="fixed inset-0 flex flex-col bg-bg text-text overflow-hidden">
        {/* Grain overlay */}
        <div className="grain pointer-events-none fixed inset-0 z-[5]" />

        {/* Ambient orb — un solo orb sutil que cambia de color según el agente
            activo. Pausa cuando la PWA está en background (data-page-hidden).
            Se oculta en mobile para preservar batería. */}
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden hidden md:block">
          <div
            className="ambient-orb w-96 h-96 opacity-[0.04]"
            style={{
              background: `radial-gradient(circle, ${agent === "kronos" ? "var(--color-kronos)" : "var(--color-noa)"} 0%, transparent 70%)`,
              top: "-10%",
              right: "-15%",
              animation: "float 18s ease-in-out infinite",
              transition: "background 0.6s ease",
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
              unreadCount={unreadCount}
              onOpenNotifications={() => setActivePanel("notifications")}
              memoryUsage={memoryUsage}
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
            isHidden={modalImage.isHidden}
            currentRating={modalImage.rating}
            onDelete={modalImage.id ? handleViewerDelete : undefined}
            onEdit={handleEditImage}
            onAnimate={handleAnimateImage}
            onHide={modalImage.id ? handleViewerHide : undefined}
            onRate={modalImage.id ? handleViewerRate : undefined}
            onClose={() => setModalImage(null)}
          />
        )}

        {/* SW update banner */}
        {swUpdate && <UpdateBanner onUpdate={handleUpdate} />}

        {/* Push toast */}
        <PushToast />
      </div>
    </TooltipProvider>
    </ToastProvider>
  );
}
