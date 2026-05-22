import { AppBackground } from "@/components/layout/AppBackground";
import { ChatEmpty } from "@/components/chat/ChatEmpty";
import { useRoute } from "@/hooks/useRoute";

/**
 * App root — Fase 0 esqueleto mínimo.
 *
 * En Fases siguientes:
 * - Fase 1: design system foundation (UI primitives, glass, sparkle)
 * - Fase 2: AppShell + Sidebar + TopBar + Auth + routing
 * - Fase 3: chat streaming + messages
 * - Fase 4: cards inline (8 tipos)
 * - Fase 5: pages utility (Gallery, History, Settings)
 * - Fase 6: voice integration
 * - Fase 7: polish + deploy
 */
export default function App() {
  const route = useRoute();

  return (
    <>
      <AppBackground />
      <main className="relative z-10 h-full">
        {route.kind === "chat" && <ChatEmpty userName="Jesús" />}
        {route.kind === "galeria" && <PlaceholderPage title="Galería" />}
        {route.kind === "historial" && <PlaceholderPage title="Historial" />}
        {route.kind === "config" && <PlaceholderPage title="Configuración" />}
      </main>
    </>
  );
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6">
      <h1 className="display text-2xl text-white/90 mb-2">{title}</h1>
      <p className="text-sm text-white/40">En construcción · Fase 5</p>
    </div>
  );
}
