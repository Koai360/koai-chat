import { useState, useEffect, useRef, useCallback } from "react";
import { API_URL } from "@/config";
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
    if (googleBtn) googleBtn.click();
  };

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden z-50"
      style={{ backgroundColor: "#EDE5DD" }}
    >
      {/* ===== HEADER — Dark mountains with KOAI logo ===== */}
      <div
        className="relative w-full shrink-0 overflow-hidden"
        style={{ height: "calc(308px + env(safe-area-inset-top, 0px))" }}
      >
        {/* Background image — full width, covers safe area */}
        <img
          src="/images/login-header-bg.svg"
          alt=""
          className="absolute inset-0 w-full h-full"
          style={{ objectFit: "cover", objectPosition: "center bottom" }}
        />
        {/* KOAI Studios logo — centered, 178x100 at top:68px from Figma */}
        <img
          src="/images/koai-logo-lg.png"
          alt="KOAI Studios"
          className="absolute left-1/2 -translate-x-1/2"
          style={{
            width: "178px",
            height: "100px",
            objectFit: "contain",
            top: "calc(68px + env(safe-area-inset-top, 0px))",
          }}
        />
      </div>

      {/* ===== CENTER CONTENT — Bot icon + Text + Button ===== */}
      <div className="flex-1 flex flex-col items-center justify-center px-[52px]">
        <div className="w-full max-w-[335px] flex flex-col items-center gap-[36px]">
          {/* Bot icon 90x90 + Text block */}
          <div className="flex flex-col items-center gap-[8px] w-full">
            <img
              src="/images/kira-bot-icon.svg"
              alt="Kira AI"
              className="w-[90px] h-[90px]"
            />
            <div className="flex flex-col items-center justify-center h-[98px] w-full text-center">
              <p
                className="text-[24px] font-semibold text-[#0D121C] leading-normal"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Lets Get Started
              </p>
              <p
                className="text-[16px] font-normal text-[#4B5565] leading-[1.6] tracking-[-0.32px]"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Experience smarter conversations
                <br />
                with Kira AI
              </p>
            </div>
          </div>

          {/* Google Sign-In button — #582C77 bg, rounded-20/16, h-64 */}
          <div className="w-full">
            {/* Hidden real Google SSO button */}
            <div ref={googleBtnRef} className="absolute opacity-0 pointer-events-none" />

            {/* Visible styled button matching Figma exactly */}
            <button
              onClick={handleGoogleButtonClick}
              disabled={loading}
              className="w-full h-[64px] rounded-[16px] flex items-center justify-center gap-[10px] p-[16px] transition-all active:scale-[0.98] disabled:opacity-60"
              style={{ backgroundColor: "#582C77", borderRadius: "20px" }}
            >
              {loading ? (
                <Loader2 className="w-6 h-6 animate-spin text-[#C0D930]" />
              ) : (
                <>
                  <img src="/images/google-g-icon.svg" alt="" className="w-5 h-5 shrink-0" />
                  <span
                    className="text-[28px] tracking-[0.38px] leading-[34px] whitespace-nowrap"
                    style={{ fontFamily: "-apple-system, 'SF Pro', system-ui, sans-serif", color: "#C0D930" }}
                  >
                    Sign Up with Google
                  </span>
                </>
              )}
            </button>

            {/* Manual login link */}
            <div className="flex flex-col items-center gap-2 mt-4">
              {!googleReady && !showFallback && (
                <div className="flex items-center gap-2 text-[14px] text-[#4B5565]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando...
                </div>
              )}
              <button
                type="button"
                onClick={() => setShowFallback(true)}
                className="text-[13px] text-[#582C77] hover:underline"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Usar login manual
              </button>
            </div>
          </div>

          {/* Fallback login form */}
          {showFallback && (
            <form onSubmit={handleFallbackSubmit} className="w-full space-y-3">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Usuario"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                disabled={loading}
                className="w-full h-[52px] px-4 rounded-[14px] border border-[#D5CEC8] text-[#0D121C] text-[16px] outline-none focus:border-[#582C77] transition-colors"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", backgroundColor: "rgba(255,255,255,0.6)" }}
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Contraseña"
                autoComplete="current-password"
                disabled={loading}
                className="w-full h-[52px] px-4 rounded-[14px] border border-[#D5CEC8] text-[#0D121C] text-[16px] outline-none focus:border-[#582C77] transition-colors"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", backgroundColor: "rgba(255,255,255,0.6)" }}
              />
              <button
                type="submit"
                disabled={loading || !username.trim() || !password.trim()}
                className="w-full h-[56px] rounded-[16px] text-[18px] font-semibold transition-all active:scale-[0.98] disabled:opacity-60"
                style={{ backgroundColor: "#582C77", color: "#C0D930", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                {loading ? "Entrando..." : "Iniciar sesión"}
              </button>
            </form>
          )}

          {/* Error */}
          {error && (
            <div className="w-full px-4 py-3 rounded-[14px] bg-red-50 border border-red-200">
              <p className="text-[14px] text-red-600 text-center" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                {error}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ===== BOTTOM — "Lets Get Started" + Home Indicator ===== */}
      <div
        className="shrink-0 flex flex-col items-center gap-[8px] pb-[8px]"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 8px)" }}
      >
        <p
          className="text-[24px] font-semibold text-[#0D121C] text-center"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          Lets Get Started
        </p>
        {/* Home indicator visual (iOS renders its own, this matches Figma) */}
        <div className="w-[134px] h-[5px] rounded-[100px] bg-[#0D121C]" />
      </div>
    </div>
  );
}
