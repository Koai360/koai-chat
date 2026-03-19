import { useState, useEffect, useRef, useCallback } from "react";
import { API_URL } from "@/config";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

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

  const handleGoogleButtonClick = () => {
    const googleBtn = googleBtnRef.current?.querySelector('div[role="button"]') as HTMLElement;
    if (googleBtn) {
      googleBtn.click();
    }
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-white relative overflow-hidden z-50">
      {/* Header image — dark mountains/particles with KOAI logo */}
      <div className="relative w-full shrink-0" style={{ height: "calc(308px + env(safe-area-inset-top, 0px))" }}>
        <img
          src="/images/login-header.svg"
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div
          className="relative z-10 flex items-center justify-center"
          style={{ paddingTop: "calc(9px + env(safe-area-inset-top, 0px))" }}
        >
          <img
            src="/images/koai-logo.png"
            alt="KOAI Studios"
            className="h-14 object-contain"
          />
        </div>
      </div>

      {/* Main content — centered */}
      <div className="flex-1 flex flex-col items-center justify-center px-[52px]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="w-full max-w-[335px] flex flex-col items-center gap-[36px]"
        >
          {/* Bot icon + text */}
          <div className="flex flex-col items-center gap-2 w-full">
            <img
              src="/images/kira-bot.svg"
              alt="Kira AI"
              className="w-[90px] h-[90px]"
            />
            <div className="text-center w-full">
              <h1
                className="text-[24px] font-semibold text-[#0D121C] leading-normal"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Lets Get Started
              </h1>
              <p
                className="text-[16px] text-[#4B5565] leading-[1.6] tracking-[-0.32px] mt-1"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Experience smarter conversations
                <br />
                with Kira AI
              </p>
            </div>
          </div>

          {/* Google Sign-In */}
          <div className="w-full flex flex-col items-center gap-4">
            {/* Hidden real Google button */}
            <div ref={googleBtnRef} className="absolute opacity-0 pointer-events-none" />

            {/* Custom styled button matching Figma */}
            <button
              onClick={handleGoogleButtonClick}
              disabled={loading}
              className="w-full h-[64px] rounded-[16px] flex items-center justify-center gap-[10px] transition-all active:scale-[0.98] disabled:opacity-60"
              style={{ backgroundColor: "#582C77" }}
            >
              {loading ? (
                <Loader2 className="w-6 h-6 animate-spin text-[#C0D930]" />
              ) : (
                <>
                  <img src="/images/google-icon.svg" alt="" className="w-5 h-5" />
                  <span
                    className="text-[28px] tracking-[0.38px] leading-[34px]"
                    style={{ fontFamily: "-apple-system, 'SF Pro', sans-serif", color: "#C0D930" }}
                  >
                    Sign Up with Google
                  </span>
                </>
              )}
            </button>

            {/* Loading / fallback link */}
            {!googleReady && !showFallback && (
              <div className="flex items-center gap-2 text-sm text-[#4B5565]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando...
              </div>
            )}
            <button
              type="button"
              onClick={() => setShowFallback(true)}
              className="text-xs text-[#582C77] hover:underline"
            >
              Usar login manual
            </button>
          </div>

          {/* Fallback login form */}
          {showFallback && (
            <motion.form
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              onSubmit={handleFallbackSubmit}
              className="w-full space-y-3"
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
                className="w-full h-12 px-4 rounded-[12px] border border-[#E5E7EB] bg-[#F9FAFB] text-[#0D121C] text-[16px] outline-none focus:border-[#582C77] transition-colors"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Contraseña"
                autoComplete="current-password"
                disabled={loading}
                className="w-full h-12 px-4 rounded-[12px] border border-[#E5E7EB] bg-[#F9FAFB] text-[#0D121C] text-[16px] outline-none focus:border-[#582C77] transition-colors"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              />
              <button
                type="submit"
                disabled={loading || !username.trim() || !password.trim()}
                className="w-full h-[56px] rounded-[16px] text-[18px] font-semibold text-[#C0D930] transition-all active:scale-[0.98] disabled:opacity-60"
                style={{ backgroundColor: "#582C77", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                {loading ? "Entrando..." : "Iniciar sesión"}
              </button>
            </motion.form>
          )}

          {/* Error */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full px-4 py-3 rounded-[12px] bg-red-50 border border-red-200"
            >
              <p className="text-sm text-red-600 text-center">{error}</p>
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* Bottom — "Lets Get Started" + home indicator */}
      <div
        className="shrink-0 flex flex-col items-center pb-2"
        style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}
      >
        <h2
          className="text-[24px] font-semibold text-[#0D121C] text-center"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          Lets Get Started
        </h2>
      </div>
    </div>
  );
}
