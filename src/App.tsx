import { useAuth } from "@/hooks/useAuth";
import { LoginScreen } from "@/components/auth/LoginScreen";
import { AppShell } from "@/components/layout/AppShell";
import { Sparkle } from "@/components/chat/Sparkle";
import { AppBackground } from "@/components/layout/AppBackground";
import { UpdateBanner } from "@/components/shared/UpdateBanner";
import { Toaster } from "sonner";

export default function App() {
  const { user, loading, loginWithGoogle, logout } = useAuth();

  if (loading) {
    return (
      <>
        <AppBackground />
        <main className="relative z-10 h-full flex items-center justify-center">
          <Sparkle size={40} animate />
        </main>
      </>
    );
  }

  if (!user) {
    return (
      <>
        <LoginScreen onGoogleLogin={loginWithGoogle} />
        <Toaster theme="dark" position="top-right" />
      </>
    );
  }

  return (
    <>
      <AppShell user={user} onLogout={logout} />
      <UpdateBanner />
      <Toaster
        theme="dark"
        position="top-right"
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
