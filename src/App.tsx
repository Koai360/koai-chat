import { useAuth } from "./hooks/useAuth";
import { AppShell } from "./components/layout/AppShell";
import { LoginScreen } from "./components/shared/LoginScreen";
import { LoadingScreen } from "./components/shared/LoadingScreen";

export default function App() {
  const auth = useAuth();

  if (auth.isLoading) {
    return <LoadingScreen />;
  }

  if (!auth.isAuthenticated) {
    return <LoginScreen onLogin={auth.login} onGoogleLogin={auth.loginWithGoogle} />;
  }

  return <AppShell user={auth.user!} onLogout={auth.logout} />;
}
