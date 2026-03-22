import { useEffect } from "react";
import { useAuth } from "./hooks/useAuth";
import { AppShell } from "./components/layout/AppShell";
import { LoginScreen } from "./components/shared/LoginScreen";
import { LoadingScreen } from "./components/shared/LoadingScreen";

export default function App() {
  const auth = useAuth();

  // Sync body/html background with auth state
  // When authenticated, useTheme handles body bg dynamically
  // When NOT authenticated, override for login screen
  useEffect(() => {
    if (!auth.isAuthenticated) {
      document.body.style.backgroundColor = "#EDE5DD";
      document.documentElement.style.backgroundColor = "#EDE5DD";
    }
    // No cleanup needed — useTheme takes over when AppShell mounts
  }, [auth.isAuthenticated]);

  if (auth.isLoading) {
    return <LoadingScreen />;
  }

  if (!auth.isAuthenticated) {
    return <LoginScreen onLogin={auth.login} onGoogleLogin={auth.loginWithGoogle} />;
  }

  return <AppShell user={auth.user!} onLogout={auth.logout} />;
}
