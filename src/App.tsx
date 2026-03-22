import { useEffect } from "react";
import { useAuth } from "./hooks/useAuth";
import { AppShell } from "./components/layout/AppShell";
import { LoginScreen } from "./components/shared/LoginScreen";
import { LoadingScreen } from "./components/shared/LoadingScreen";

export default function App() {
  const auth = useAuth();

  // Sync body/html background with auth state
  useEffect(() => {
    const theme = document.documentElement.classList.contains("dark") ? "dark" : "light";
    const bg = auth.isAuthenticated
      ? (theme === "dark" ? "#0a0a0c" : "#ffffff")
      : "#EDE5DD";
    document.body.style.backgroundColor = bg;
    document.documentElement.style.backgroundColor = bg;
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
