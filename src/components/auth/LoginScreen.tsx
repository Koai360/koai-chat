import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { AlertCircle } from "lucide-react";
import { AppBackground } from "@/components/layout/AppBackground";
import { Sparkle } from "@/components/chat/Sparkle";

interface LoginScreenProps {
  mountGoogleButton: (el: HTMLElement) => void | Promise<void>;
  error: string | null;
  loading: boolean;
}

export function LoginScreen({ mountGoogleButton, error, loading }: LoginScreenProps) {
  const btnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!btnRef.current) return;
    void mountGoogleButton(btnRef.current);
  }, [mountGoogleButton]);

  return (
    <>
      <AppBackground />
      <main className="relative z-10 h-full flex flex-col items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
          className="flex flex-col items-center text-center max-w-md"
        >
          <Sparkle size={56} animate className="mb-8" />

          <h1
            className="display font-semibold text-white leading-[1.1] mb-3"
            style={{ fontSize: "clamp(2rem, 6vw, 3rem)" }}
          >
            Noa
          </h1>

          <p className="text-white/60 text-base mb-10 leading-relaxed max-w-sm">
            Asistente interna de KOAI Studios.
            <br />
            Inicia sesión con tu cuenta del equipo.
          </p>

          {/* Google Identity Services renderiza su botón aquí */}
          <div className="min-h-[44px] flex items-center justify-center">
            {loading ? (
              <span className="size-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            ) : (
              <div ref={btnRef} />
            )}
          </div>

          {error && (
            <div className="mt-4 flex items-center gap-2 text-[13px] text-[var(--color-danger)] bg-[var(--color-danger-soft)] border border-[var(--color-danger)]/30 rounded-lg px-3 py-2 max-w-sm">
              <AlertCircle className="size-4 shrink-0" />
              <span className="text-left">{error}</span>
            </div>
          )}

          <p className="text-white/55 text-xs mt-8">
            Solo accesible para el equipo @koai360.com
          </p>
        </motion.div>
      </main>
    </>
  );
}
