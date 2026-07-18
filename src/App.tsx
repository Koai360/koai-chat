import { useAuth } from "@/hooks/useAuth";
import { LoginScreen } from "@/components/auth/LoginScreen";
import { AppShell } from "@/components/layout/AppShell";
import { Sparkle } from "@/components/chat/Sparkle";
import { AppBackground } from "@/components/layout/AppBackground";
import { UpdateBanner } from "@/components/shared/UpdateBanner";
import { Toaster } from "sonner";

export default function App() {
  const { user, loading, error, mountGoogleButton, logout } = useAuth();

  if (loading && !user) {
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
        <LoginScreen
          mountGoogleButton={mountGoogleButton}
          error={error}
          loading={loading}
        />
        <Toaster theme="dark" position="top-right" />
      </>
    );
  }

  return (
    <>
      <AppShell user={user} onLogout={logout} />
      <UpdateBanner />
      {/* Brief Noa 07-05: en mobile el toast top-right caía SOBRE los íconos del
          TopBar (safe-area + 64px) — tapaba los botones y se veía "pisado" por el
          blur del header. mobileOffset lo baja por debajo del header; el toast
          flota libre sin pisar ni ser pisado. */}
      <Toaster
        theme="dark"
        position="top-right"
        mobileOffset={{
          top: "calc(env(safe-area-inset-top, 0px) + 76px)",
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
