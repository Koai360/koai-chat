import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Power, Loader2, Languages, ChevronDown } from "lucide-react";
import { useRealtimeTranslate, type TranslateState } from "@/hooks/useRealtimeTranslate";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";

/**
 * TranslatePage — traducción speech→speech en tiempo real con
 * OpenAI gpt-realtime-translate. Auto-detecta el idioma origen,
 * el user elige el destino. Voice-matching dinámico.
 *
 * $0.034/min. Cap de seguridad 15 min por sesión.
 */

type Lang = { code: string; label: string; flag: string };

const LANGUAGES: Lang[] = [
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "pt", label: "Português", flag: "🇧🇷" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "it", label: "Italiano", flag: "🇮🇹" },
  { code: "ja", label: "日本語", flag: "🇯🇵" },
  { code: "ko", label: "한국어", flag: "🇰🇷" },
  { code: "zh", label: "中文", flag: "🇨🇳" },
  { code: "ar", label: "العربية", flag: "🇸🇦" },
  { code: "hi", label: "हिन्दी", flag: "🇮🇳" },
  { code: "ru", label: "Русский", flag: "🇷🇺" },
  { code: "nl", label: "Nederlands", flag: "🇳🇱" },
];

const STORAGE_KEY = "koai-translate-target-lang";
const PRICE_PER_MIN = 0.034;

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function formatCost(seconds: number): string {
  const cost = (seconds / 60) * PRICE_PER_MIN;
  return `$${cost.toFixed(3)}`;
}

const STATUS_COPY: Record<TranslateState, { label: string; tone: "muted" | "active" | "warn" }> = {
  disconnected: { label: "Listo para traducir", tone: "muted" },
  connecting: { label: "Conectando con OpenAI…", tone: "muted" },
  idle: { label: "Hablá cuando quieras", tone: "active" },
  listening: { label: "Escuchando…", tone: "active" },
  translating: { label: "Traduciendo…", tone: "active" },
  speaking: { label: "Reproduciendo traducción…", tone: "active" },
  error: { label: "Hubo un error", tone: "warn" },
};

export function TranslatePage() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [targetLang, setTargetLang] = useState<string>(() => {
    if (typeof window === "undefined") return "en";
    return localStorage.getItem(STORAGE_KEY) || "en";
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, targetLang);
    } catch {
      /* noop */
    }
  }, [targetLang]);

  const {
    state,
    error,
    sourceText,
    translatedText,
    elapsedSec,
    audioLevel,
    muted,
    connect,
    disconnect,
    toggleMute,
  } = useRealtimeTranslate({
    targetLanguage: targetLang,
    audioElement: audioRef.current,
  });

  const targetLabel = useMemo(
    () => LANGUAGES.find((l) => l.code === targetLang) ?? LANGUAGES[0],
    [targetLang]
  );

  const isActive = state !== "disconnected" && state !== "error";
  const status = STATUS_COPY[state];

  // Si cambian el idioma destino con la sesión activa, hay que reconectar.
  // (gpt-realtime-translate no permite cambiar target con session.update)
  const langChangeWarning = isActive && state !== "connecting";

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header */}
      <header className="shrink-0 px-5 md:px-8 pt-5 md:pt-7 pb-3 md:pb-4 border-b border-border">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-bg-elevated flex items-center justify-center">
              <Languages className="size-5 text-noa" />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-display font-medium">Traducción en vivo</h1>
              <p className="text-xs text-text-muted">
                Habla cualquier idioma · Noa lo traduce a {targetLabel.label}
              </p>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bg-elevated hover:bg-white/[0.06] text-sm transition"
                disabled={isActive && state === "connecting"}
              >
                <span className="text-base leading-none">{targetLabel.flag}</span>
                <span>{targetLabel.label}</span>
                <ChevronDown className="size-4 opacity-60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-80 overflow-auto">
              {LANGUAGES.map((lang) => (
                <DropdownMenuItem
                  key={lang.code}
                  onClick={() => {
                    if (isActive) disconnect();
                    setTargetLang(lang.code);
                  }}
                  className={lang.code === targetLang ? "bg-white/[0.05]" : ""}
                >
                  <span className="text-base mr-2">{lang.flag}</span>
                  {lang.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {langChangeWarning && (
          <p className="mt-2 text-[11px] text-text-muted">
            Cambiar el idioma destino reinicia la sesión.
          </p>
        )}
      </header>

      {/* Center: orb + captions */}
      <div className="flex-1 min-h-0 flex flex-col">
        {/* Orb */}
        <div className="flex-1 min-h-[180px] md:min-h-[240px] flex items-center justify-center px-5">
          <TranslateOrb state={state} level={audioLevel} />
        </div>

        {/* Captions */}
        <div className="px-5 md:px-8 pb-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-4xl mx-auto">
            <CaptionCard
              label="Lo que dices"
              text={sourceText}
              tone="user"
              placeholder={isActive ? "—" : "Pulsá Iniciar para empezar."}
            />
            <CaptionCard
              label={`Traducción · ${targetLabel.label}`}
              text={translatedText}
              tone="translated"
              placeholder={isActive ? "—" : ""}
            />
          </div>
        </div>
      </div>

      {/* Footer controls */}
      <footer className="shrink-0 px-5 md:px-8 py-4 border-t border-border bg-bg/60 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-3 max-w-4xl mx-auto">
          {/* Left: meta */}
          <div className="text-xs text-text-muted min-w-[110px]">
            <div className="flex items-center gap-2">
              <span
                className={
                  status.tone === "warn"
                    ? "text-red-400"
                    : status.tone === "active"
                      ? "text-noa"
                      : "text-text-muted"
                }
              >
                {state === "connecting" ? (
                  <Loader2 className="size-3.5 animate-spin inline mr-1" />
                ) : null}
                {status.label}
              </span>
            </div>
            {isActive && (
              <div className="mt-0.5 tabular-nums opacity-70">
                {formatTime(elapsedSec)} · {formatCost(elapsedSec)}
              </div>
            )}
          </div>

          {/* Center: primary button */}
          <div className="flex items-center gap-3">
            {isActive && (
              <button
                onClick={toggleMute}
                aria-label={muted ? "Activar micrófono" : "Silenciar micrófono"}
                className={`p-3 rounded-full transition ${
                  muted
                    ? "bg-red-500/15 text-red-400 hover:bg-red-500/25"
                    : "bg-bg-elevated text-text hover:bg-white/[0.06]"
                }`}
              >
                {muted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
              </button>
            )}

            <button
              onClick={isActive ? disconnect : connect}
              disabled={state === "connecting"}
              className={`px-5 py-2.5 rounded-full text-sm font-medium transition flex items-center gap-2 ${
                isActive
                  ? "bg-bg-elevated text-text hover:bg-white/[0.06]"
                  : "bg-noa text-bg hover:opacity-90"
              } disabled:opacity-50`}
            >
              <Power className="size-4" />
              {isActive ? "Detener" : "Iniciar"}
            </button>
          </div>

          {/* Right: spacer for symmetry on desktop */}
          <div className="min-w-[110px] hidden sm:block" />
        </div>

        {error && (
          <div className="mt-3 max-w-4xl mx-auto px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-xs">
            {error}
          </div>
        )}
      </footer>

      {/* Hidden audio output */}
      <audio ref={audioRef} autoPlay playsInline />
    </div>
  );
}

function CaptionCard({
  label,
  text,
  tone,
  placeholder,
}: {
  label: string;
  text: string;
  tone: "user" | "translated";
  placeholder: string;
}) {
  return (
    <div
      className={`rounded-2xl p-4 md:p-5 min-h-[110px] md:min-h-[140px] liquid-glass ${
        tone === "translated" ? "ring-1 ring-noa/20" : ""
      }`}
    >
      <div className="text-[10px] uppercase tracking-widest text-text-muted mb-2">
        {label}
      </div>
      <ScrollArea className="max-h-32 md:max-h-40">
        <p
          className={`text-sm md:text-base leading-relaxed whitespace-pre-wrap ${
            text ? "text-text" : "text-text-subtle italic"
          }`}
        >
          {text || placeholder}
        </p>
      </ScrollArea>
    </div>
  );
}

function TranslateOrb({ state, level }: { state: TranslateState; level: number }) {
  const isActive = state !== "disconnected" && state !== "error";
  const ringScale = 1 + Math.min(0.35, level * 0.9);

  return (
    <div className="relative size-40 md:size-52 flex items-center justify-center">
      <AnimatePresence>
        {isActive && (
          <motion.div
            key="ring"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 0.6, scale: ringScale }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 rounded-full"
            style={{
              background:
                "radial-gradient(circle at 50% 50%, var(--color-noa-glow) 0%, transparent 65%)",
            }}
          />
        )}
      </AnimatePresence>

      <motion.div
        animate={{
          scale: state === "speaking" ? [1, 1.06, 1] : 1,
        }}
        transition={{
          duration: state === "speaking" ? 0.9 : 0.4,
          repeat: state === "speaking" ? Infinity : 0,
          ease: "easeInOut",
        }}
        className="relative size-28 md:size-36 rounded-full flex items-center justify-center"
        style={{
          background:
            "radial-gradient(circle at 35% 30%, var(--color-noa) 0%, var(--color-noa-glow) 55%, transparent 90%)",
          boxShadow: isActive
            ? "0 0 60px var(--color-noa-glow), inset 0 0 30px rgba(255,255,255,0.1)"
            : "0 0 30px rgba(0,0,0,0.4)",
          filter: state === "listening" ? "brightness(1.1)" : "brightness(1)",
        }}
      >
        <Languages className="size-10 md:size-12 text-bg opacity-70" />
      </motion.div>
    </div>
  );
}
