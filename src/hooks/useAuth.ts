import { useCallback, useEffect, useState } from "react";
import { getAuthToken, setAuthToken } from "@/lib/api";
import type { AuthUser } from "@/types/api";

const USER_KEY = "noa.user";

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
}

/**
 * useAuth — gestiona session con backend koai-api.
 *
 * El flow real de Google OAuth:
 *   1. Frontend redirige a `${API_BASE}/api/auth/google/login?redirect_uri=...`
 *   2. Backend devuelve a callback con `?token=JWT&user=base64(json)`
 *   3. Frontend persiste token + user en localStorage
 *
 * En dev también soporta token + user manual via localStorage.
 */
export function useAuth(): AuthState & {
  loginWithGoogle: () => void;
  logout: () => void;
} {
  const [state, setState] = useState<AuthState>(() => {
    const token = getAuthToken();
    const rawUser = localStorage.getItem(USER_KEY);
    if (token && rawUser) {
      try {
        return { user: JSON.parse(rawUser) as AuthUser, loading: false };
      } catch {
        /* fallthrough — user corrupt, sigue como sin sesión */
      }
    }
    return { user: null, loading: true };
  });

  // Procesa callback de OAuth: si la URL tiene ?token=...&user=..., guarda y limpia.
  // Independiente de eso, SIEMPRE garantizamos que loading termine (sino app stuck en sparkle).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const userB64 = params.get("user");

    if (token && userB64) {
      try {
        const userJson = atob(userB64);
        const user = JSON.parse(userJson) as AuthUser;
        setAuthToken(token);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        setState({ user, loading: false });
        // Limpia los query params para que no quede el token visible
        const url = new URL(window.location.href);
        url.search = "";
        window.history.replaceState({}, "", url.toString());
        return;
      } catch (err) {
        console.warn("[useAuth] callback parse error", err);
      }
    }

    // SIEMPRE terminar loading después del init. Cubre 4 casos:
    //   - sin token + sin user → LoginScreen
    //   - sin token + user huérfano → limpia + LoginScreen
    //   - token + user válido → AppShell (ya seteado en useState init)
    //   - token + user corrupto/missing → limpia token viejo + LoginScreen (forzar re-login)
    setState((prev) => {
      if (prev.user) return prev; // ya tiene user válido, no tocamos
      // No user válido: si hay token huérfano, lo limpiamos
      if (getAuthToken()) {
        setAuthToken(null);
        localStorage.removeItem(USER_KEY);
      }
      return { user: null, loading: false };
    });
  }, []);

  const loginWithGoogle = useCallback(() => {
    const apiBase = import.meta.env.VITE_API_BASE || "https://api.koai360.com";
    const redirectUri = window.location.origin + window.location.pathname;
    window.location.href = `${apiBase}/api/auth/google/login?redirect_uri=${encodeURIComponent(redirectUri)}`;
  }, []);

  const logout = useCallback(() => {
    setAuthToken(null);
    localStorage.removeItem(USER_KEY);
    setState({ user: null, loading: false });
  }, []);

  return {
    user: state.user,
    loading: state.loading,
    loginWithGoogle,
    logout,
  };
}
