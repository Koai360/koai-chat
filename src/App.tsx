import { useEffect } from "react";
import { useAuth } from "./hooks/useAuth";
import { AppShell } from "./components/layout/AppShell";
import { LoginScreen } from "./components/shared/LoginScreen";
import { LoadingScreen } from "./components/shared/LoadingScreen";

export default function App() {
  const auth = useAuth();

  // Sync body/html background with auth state
  // Sync body/html background with auth state
  // When authenticated, CSS variable var(--color-bg) handles it automatically
  // When NOT authenticated, override for login screen bg
  useEffect(() => {
    if (!auth.isAuthenticated) {
      document.body.style.backgroundColor = "#EDE5DD";
      document.documentElement.style.backgroundColor = "#EDE5DD";
    } else {
      document.body.style.backgroundColor = "";
      document.documentElement.style.backgroundColor = "";
    }
    return () => {
      document.body.style.backgroundColor = "";
      document.documentElement.style.backgroundColor = "";
    };
  }, [auth.isAuthenticated]);

  if (auth.isLoading) {
    return <LoadingScreen />;
  }

  if (!auth.isAuthenticated) {
    return <LoginScreen onLogin={auth.login} onGoogleLogin={auth.loginWithGoogle} />;
  }

  return <AppShell user={auth.user!} onLogout={auth.logout} />;
}
