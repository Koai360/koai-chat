import { useAuth } from "@/hooks/useAuth";
import { LoginScreen } from "@/components/auth/LoginScreen";
import { AppShell } from "@/components/layout/AppShell";
import { Sparkle } from "@/components/chat/Sparkle";
import { AppBackground } from "@/components/layout/AppBackground";
import { UpdateBanner } from "@/components/shared/UpdateBanner";
import { Toaster } from "sonner";

export default function App() {
  const { user, loading, error, mountGoogleButton, logout } = useAuth();

  let content;
  if (loading && !user) {
    content = (
      <>
        <AppBackground />
        <main className="relative z-10 h-full flex items-center justify-center">
          <Sparkle size={40} animate />
        </main>
      </>
    );
  } else if (!user) {
    content = (
      <LoginScreen
        mountGoogleButton={mountGoogleButton}
        error={error}
        loading={loading}
      />
    );
  } else {
    content = (
      <>
        <AppShell user={user} onLogout={logout} />
        <UpdateBanner />
      </>
    );
  }

  return (
    <>
      {content}
      {/* Toaster ÚNICO global — safe-area por diseño en TODOS los estados
          (login incluido). Antes había dos <Toaster>: el del login sin offset
          (caía detrás del notch) y el de la app parchado a mano. Con status-bar
          black-translucent el toast debe librar el notch (desktop: inset=0) y el
          TopBar mobile (safe-area + header ~64px). Offsets vía tokens --sat. */}
      <Toaster
        theme="dark"
        position="top-right"
        offset={{
          top: "calc(var(--sat) + 16px)",
          right: 16,
          left: 16,
        }}
        mobileOffset={{
          top: "calc(var(--sat) + 76px)",
          right: 12,
          left: 12,
        }}
        toastOptions={{
          style: {
            background: "var(--color-bg-overlay)",
            border: "1px solid var(--color-border-hi)",
            color: "var(--color-text)",
          },
        }}
      />
    </>
  );
}
