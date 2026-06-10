import { useCallback, useEffect, useState } from "react";
import { getAuthToken, setAuthToken, isJwtExpired } from "@/lib/api";
import type { AuthUser } from "@/types/api";

const USER_KEY = "noa.user";
const API_BASE = import.meta.env.VITE_API_BASE || "https://api.koai360.com";

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
}

/**
 * useAuth — gestiona sesión con backend koai-api.
 *
 * Flow: Google Identity Services (GIS) + backend POST /api/auth/google
 *   1. Frontend pide GOOGLE_CLIENT_ID a /api/auth/google-client-id (público)
 *   2. Carga script https://accounts.google.com/gsi/client
 *   3. Inicializa google.accounts.id con client_id + callback
 *   4. Usuario clickea botón → Google devuelve credential (JWT firmado por Google)
 *   5. Frontend POST a /api/auth/google con {credential}
 *   6. Backend valida con Google tokeninfo + devuelve nuestro JWT
 *   7. Persistimos token + user en localStorage
 *
 * Restricción dominio: solo @koai360.com (enforced server-side).
 */

interface GoogleCredentialResponse {
  credential: string;
  select_by?: string;
}

// Tipos globales de Google Identity Services
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: GoogleCredentialResponse) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
            use_fedcm_for_prompt?: boolean;
          }) => void;
          renderButton: (
            element: HTMLElement,
            config: {
              type?: "standard" | "icon";
              theme?: "outline" | "filled_blue" | "filled_black";
              size?: "large" | "medium" | "small";
              text?: "signin_with" | "signup_with" | "continue_with" | "signin";
              shape?: "rectangular" | "pill" | "circle" | "square";
              logo_alignment?: "left" | "center";
              width?: number;
              locale?: string;
            },
          ) => void;
          prompt: () => void;
          disableAutoSelect: () => void;
        };
      };
    };
  }
}

export interface UseAuthReturn {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  /** Carga + inicializa GIS y renderiza botón Google en el elemento dado. */
  mountGoogleButton: (el: HTMLElement) => Promise<void>;
  logout: () => void;
}

let gisScriptPromise: Promise<void> | null = null;

function loadGisScript(): Promise<void> {
  if (gisScriptPromise) return gisScriptPromise;
  gisScriptPromise = new Promise<void>((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("no window"));
    if (window.google?.accounts?.id) return resolve();

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]',
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("GIS script failed")));
      return;
    }
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("GIS script failed to load"));
    document.head.appendChild(s);
  });
  return gisScriptPromise;
}

async function fetchClientId(): Promise<string> {
  const res = await fetch(`${API_BASE}/api/auth/google-client-id`);
  if (!res.ok) throw new Error(`client-id fetch HTTP ${res.status}`);
  const data = await res.json();
  if (!data.client_id) throw new Error("Google client_id no configurado");
  return data.client_id as string;
}

export function useAuth(): UseAuthReturn {
  const [state, setState] = useState<AuthState>(() => {
    const token = getAuthToken();
    const rawUser = localStorage.getItem(USER_KEY);
    // Solo confiar en la sesión guardada si el token NO está expirado.
    // Un token vencido dejaba la app "logueada" pero muerta (todo 401).
    if (token && rawUser && !isJwtExpired(token)) {
      try {
        return { user: JSON.parse(rawUser) as AuthUser, loading: false, error: null };
      } catch {
        /* fallthrough — user corrupt */
      }
    }
    return { user: null, loading: true, error: null };
  });

  // Bootstrap: limpiar loading inicial si no hay sesión válida
  useEffect(() => {
    setState((prev) => {
      if (prev.user) return prev;
      // Limpiar token huérfano o expirado si existe
      if (getAuthToken()) {
        setAuthToken(null);
        localStorage.removeItem(USER_KEY);
      }
      return { user: null, loading: false, error: null };
    });
  }, []);

  // Sesión invalidada por el backend (401) en cualquier llamada → forzar login.
  useEffect(() => {
    const onUnauthorized = () => {
      // S158-b: antes el kick al login era sin explicación — el usuario no
      // sabía si era bug o sesión vencida
      setState({
        user: null,
        loading: false,
        error: "Tu sesión expiró — iniciá sesión de nuevo.",
      });
    };
    window.addEventListener("noa:unauthorized", onUnauthorized);
    return () => window.removeEventListener("noa:unauthorized", onUnauthorized);
  }, []);

  const handleCredential = useCallback(async (credential: string) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const res = await fetch(`${API_BASE}/api/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
      });

      if (!res.ok) {
        let detail = `HTTP ${res.status}`;
        try {
          const data = await res.json();
          if (data?.detail) detail = data.detail;
        } catch {
          /* noop */
        }
        throw new Error(detail);
      }

      const data: { token: string; user: AuthUser; expires_at: string } = await res.json();
      setAuthToken(data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      setState({ user: data.user, loading: false, error: null });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Login falló";
      console.error("[useAuth] login error", err);
      setState({ user: null, loading: false, error: msg });
    }
  }, []);

  const mountGoogleButton = useCallback(
    async (el: HTMLElement) => {
      try {
        const [, clientId] = await Promise.all([loadGisScript(), fetchClientId()]);
        if (!window.google?.accounts?.id) throw new Error("GIS no disponible");

        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (resp) => {
            if (resp.credential) {
              void handleCredential(resp.credential);
            }
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        // Limpia render previo (si re-monta)
        el.innerHTML = "";
        window.google.accounts.id.renderButton(el, {
          type: "standard",
          theme: "filled_black",
          size: "large",
          text: "continue_with",
          shape: "pill",
          logo_alignment: "left",
          width: 280,
          locale: "es",
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Google login no disponible";
        console.error("[useAuth] mountGoogleButton failed", err);
        setState((prev) => ({ ...prev, error: msg }));
      }
    },
    [handleCredential],
  );

  const logout = useCallback(() => {
    setAuthToken(null);
    localStorage.removeItem(USER_KEY);
    window.google?.accounts?.id?.disableAutoSelect?.();
    setState({ user: null, loading: false, error: null });
  }, []);

  return {
    user: state.user,
    loading: state.loading,
    error: state.error,
    mountGoogleButton,
    logout,
  };
}
