import { useState, useEffect, useRef, useCallback } from "react";
import { API_URL } from "@/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { Loader2, AlertCircle } from "lucide-react";

interface Props {
  onLogin: (username: string, password: string) => Promise<void>;
  onGoogleLogin: (credential: string) => Promise<void>;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: Record<string, unknown>) => void;
          renderButton: (element: HTMLElement, config: Record<string, unknown>) => void;
        };
      };
    };
    handleGoogleCredential?: (response: { credential: string }) => void;
  }
}

export function LoginScreen({ onLogin, onGoogleLogin }: Props) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const onGoogleLoginRef = useRef(onGoogleLogin);
  onGoogleLoginRef.current = onGoogleLogin;

  const handleGoogleResponse = useCallback(async (response: { credential: string }) => {
    setLoading(true);
    setError("");
    try {
      await onGoogleLoginRef.current(response.credential);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    window.handleGoogleCredential = handleGoogleResponse;

    const timeout = setTimeout(() => {
      if (!cancelled && !googleReady) setShowFallback(true);
    }, 8000);

    async function initGoogle() {
      try {
        const res = await fetch(`${API_URL}/api/auth/google-client-id`);
        if (!res.ok) { setShowFallback(true); return; }
        const { client_id } = await res.json();

        if (!document.getElementById("google-gsi-script")) {
          const script = document.createElement("script");
          script.id = "google-gsi-script";
          script.src = "https://accounts.google.com/gsi/client";
          script.async = true; script.defer = true;
          document.head.appendChild(script);
          await new Promise<void>((resolve, reject) => {
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Failed to load Google GSI"));
          });
        }

        if (cancelled) return;
        await new Promise((r) => setTimeout(r, 100));

        if (!window.google?.accounts?.id) { if (!cancelled) setShowFallback(true); return; }

        window.google.accounts.id.initialize({
          client_id,
          callback: handleGoogleResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        if (googleBtnRef.current) {
          window.google.accounts.id.renderButton(googleBtnRef.current, {
            type: "standard", theme: "outline", size: "large",
            text: "signin_with", shape: "pill", logo_alignment: "left", width: 320,
          });
        }

        if (!cancelled) { setGoogleReady(true); clearTimeout(timeout); }
      } catch {
        if (!cancelled) setShowFallback(true);
      }
    }

    initGoogle();
    return () => { cancelled = true; clearTimeout(timeout); };
  }, [handleGoogleResponse]);

  const handleFallbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    setLoading(true); setError("");
    try {
      await onLogin(username.trim().toLowerCase(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col items-center justify-center bg-bg px-6 safe-top safe-bottom relative overflow-hidden">
      {/* Aurora background effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full rounded-full bg-brand/10 blur-3xl animate-aurora-float" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full rounded-full bg-kira/5 blur-3xl animate-aurora-float [animation-delay:3s]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="w-full max-w-sm relative z-10"
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="relative mb-5">
            <div className="absolute inset-0 rounded-[22px] bg-brand/20 blur-xl" />
            <img
              src="/icons/kira-logo.svg"
              alt="KOAI"
              className="relative w-24 h-24 rounded-[22px] shadow-xl"
            />
          </div>
          <h1 className="text-2xl font-bold text-text tracking-tight">KOAI Chat</h1>
          <p className="text-sm text-text-muted mt-1">Kira & Kronos — KOAI Studios</p>
        </div>

        {/* Google Sign-In */}
        {!showFallback && (
          <div className="flex flex-col items-center gap-4">
            <div ref={googleBtnRef} className={googleReady ? "" : "opacity-0 h-0"} />
            {!googleReady && (
              <div className="flex items-center gap-2 text-sm text-text-muted">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando...
              </div>
            )}
            <p className="text-[11px] text-text-muted text-center">Solo cuentas @koai360.com</p>
            {!googleReady && (
              <button
                type="button"
                onClick={() => setShowFallback(true)}
                className="text-xs text-kira hover:underline mt-2"
              >
                Usar login manual
              </button>
            )}
          </div>
        )}

        {/* Fallback login */}
        {showFallback && (
          <motion.form
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={handleFallbackSubmit}
            className="space-y-3"
          >
            <Input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Usuario"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              disabled={loading}
              className="h-12 bg-bg-surface border-border-subtle"
            />
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña"
              autoComplete="current-password"
              disabled={loading}
              className="h-12 bg-bg-surface border-border-subtle"
            />
            <Button
              type="submit"
              disabled={loading || !username.trim() || !password.trim()}
              className="w-full h-12 bg-gradient-to-r from-brand to-brand/80 hover:from-brand/90 hover:to-brand/70 text-white font-semibold shadow-lg shadow-brand/25"
            >
              {loading ? "Entrando..." : "Iniciar sesión"}
            </Button>
          </motion.form>
        )}

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 mt-4"
          >
            <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
            <p className="text-sm text-destructive">{error}</p>
          </motion.div>
        )}

        {loading && !showFallback && (
          <div className="flex items-center justify-center gap-2 text-sm text-text-muted mt-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            Verificando...
          </div>
        )}

        <p className="text-center text-[11px] text-text-muted/60 mt-10">
          KOAI Studios — Powered by AI
        </p>
      </motion.div>
    </div>
  );
}
