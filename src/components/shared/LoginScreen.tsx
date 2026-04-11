import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { API_URL } from "@/config";
import { Loader2 } from "lucide-react";
import { AIStarIcon } from "@/components/shared/AIStarIcon";

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
            type: "standard", theme: "filled_black", size: "large",
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

  const handleFallbackSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
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

  const handleGoogleButtonClick = () => {
    const googleBtn = googleBtnRef.current?.querySelector('div[role="button"]') as HTMLElement;
    if (googleBtn) {
      googleBtn.click();
    } else {
      setError("Google no disponible. Usa login manual.");
      setShowFallback(true);
    }
  };

  return (
    <div className="fixed inset-0 overflow-hidden z-50 flex flex-col bg-bg text-text">
      {/* Grain overlay */}
      <div className="grain pointer-events-none fixed inset-0 z-[5]" />

      {/* Ambient orbs — lime Kira + purple KOAI, matching splash/app vibe */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <motion.div
          className="absolute rounded-full"
          style={{
            width: "500px",
            height: "500px",
            top: "-15%",
            right: "-15%",
            background: "radial-gradient(circle, rgba(212, 233, 75, 0.12) 0%, transparent 70%)",
            filter: "blur(80px)",
          }}
          animate={{
            x: [0, 20, -10, 0],
            y: [0, -15, 10, 0],
          }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute rounded-full"
          style={{
            width: "480px",
            height: "480px",
            bottom: "-15%",
            left: "-10%",
            background: "radial-gradient(circle, rgba(123, 45, 142, 0.10) 0%, transparent 70%)",
            filter: "blur(80px)",
          }}
          animate={{
            x: [0, -15, 10, 0],
            y: [0, 12, -8, 0],
          }}
          transition={{ duration: 22, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        />
      </div>

      {/* Hidden real Google SSO button (para click delegation) */}
      <div ref={googleBtnRef} className="absolute opacity-0 pointer-events-none -z-10" />

      {/* Content scroll container */}
      <div
        className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 overflow-y-auto"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="w-full max-w-[360px] flex flex-col items-center">
          {/* AI Star icon — brand marker */}
          <motion.div
            initial={{ scale: 0.7, opacity: 0, filter: "blur(12px)" }}
            animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
            transition={{ delay: 0.1, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            style={{ filter: "drop-shadow(0 0 40px rgba(212, 233, 75, 0.25))" }}
          >
            <AIStarIcon size="lg" />
          </motion.div>

          {/* Brand */}
          <motion.div
            initial={{ y: 20, opacity: 0, filter: "blur(6px)" }}
            animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
            transition={{ delay: 0.25, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="text-center mt-6 mb-2"
          >
            <h1
              className="font-display text-[32px] font-medium leading-none tracking-tight mb-1"
              style={{ letterSpacing: "-0.025em" }}
            >
              <span className="gradient-text-kira">Noa</span>
              <span className="text-text-muted"> · </span>
              <span className="gradient-text-kronos">Kronos</span>
            </h1>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-subtle">
              by KOAI Studios
            </p>
          </motion.div>

          {/* Welcome headline */}
          <motion.div
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="text-center mb-8 mt-6"
          >
            <h2
              className="font-display text-[22px] font-medium text-text mb-1.5"
              style={{ letterSpacing: "-0.018em" }}
            >
              Bienvenido al equipo
            </h2>
            <p className="text-[13px] text-text-muted leading-snug max-w-[300px] mx-auto">
              Chat privado con Noa y Kronos. Generación de imágenes, código y estrategia en un solo lugar.
            </p>
          </motion.div>

          {/* Google button — primario */}
          <motion.button
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.55, duration: 0.5 }}
            onClick={handleGoogleButtonClick}
            disabled={loading}
            className="w-full h-[52px] flex items-center justify-center gap-3 rounded-full transition-all active:scale-[0.98] disabled:opacity-60 font-display text-[14px] font-medium"
            style={{
              backgroundColor: "#D4E94B",
              color: "#0a0a0c",
              boxShadow: "0 0 24px -6px rgba(212, 233, 75, 0.4), 0 0 0 1px rgba(212, 233, 75, 0.2)",
              letterSpacing: "-0.01em",
            }}
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <img src="/images/google-g-icon.svg" alt="" className="w-[18px] h-[18px] shrink-0" />
                <span>Continuar con Google</span>
              </>
            )}
          </motion.button>

          {/* Manual fallback toggle — sutil link */}
          {!showFallback && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7, duration: 0.5 }}
              type="button"
              onClick={() => setShowFallback(true)}
              className="mt-5 font-mono text-[11px] tracking-wide text-text-muted hover:text-text transition-colors"
            >
              o usa login manual →
            </motion.button>
          )}

          {/* Fallback form */}
          {showFallback && (
            <motion.form
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              onSubmit={handleFallbackSubmit}
              className="w-full space-y-2.5 mt-5"
            >
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Usuario"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                disabled={loading}
                className="w-full h-[48px] px-4 rounded-xl bg-bg-elevated border border-border text-text text-[15px] outline-none focus:border-kira focus:ring-1 focus:ring-kira/30 transition-all placeholder:text-text-muted"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Contraseña"
                autoComplete="current-password"
                disabled={loading}
                className="w-full h-[48px] px-4 rounded-xl bg-bg-elevated border border-border text-text text-[15px] outline-none focus:border-kira focus:ring-1 focus:ring-kira/30 transition-all placeholder:text-text-muted"
              />
              <button
                type="submit"
                disabled={loading || !username.trim() || !password.trim()}
                className="w-full h-[48px] rounded-xl text-[14px] font-display font-medium transition-all active:scale-[0.98] disabled:opacity-60 border border-border bg-bg-surface hover:bg-bg-elevated text-text"
                style={{ letterSpacing: "-0.01em" }}
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2 justify-center">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Entrando...
                  </span>
                ) : (
                  "Iniciar sesión"
                )}
              </button>
            </motion.form>
          )}

          {/* Error */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 w-full px-4 py-2.5 rounded-xl bg-danger-soft border border-danger/30"
            >
              <p className="text-[12.5px] text-danger text-center">{error}</p>
            </motion.div>
          )}
        </div>
      </div>

      {/* Footer — terms, safe-area aware */}
      <div
        className="relative z-10 shrink-0 pb-4 px-6"
        style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9, duration: 0.6 }}
          className="font-mono text-[10px] text-text-subtle text-center leading-snug"
        >
          Al continuar aceptas los términos de uso de KOAI Studios
        </motion.p>
      </div>
    </div>
  );
}
