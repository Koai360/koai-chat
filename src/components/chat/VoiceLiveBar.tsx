import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Check, Loader2, PhoneOff, Wrench } from "lucide-react";
import { useGeminiLive, toolLabel } from "@/hooks/useGeminiLive";
import { Pill } from "@/components/ui/Pill";
import { cn } from "@/lib/cn";

interface VoiceLiveBarProps {
  /** Conversación activa (uuid). Si no hay, el backend crea una y la devuelve en `ready`. */
  conversationId?: string | null;
  /** Al colgar (o cortarse): el consumidor recarga el chat y navega si la conversación es nueva. */
  onEnd: (conversationId: string | null) => void;
}

/**
 * VoiceLiveBar — llamada en tiempo real con Noa (S322, F1 de noa-voz-live).
 *
 * Reemplaza el pill del input mientras dura la llamada, igual que VoiceBar (dictado),
 * pero acá es full-duplex: hablás, Noa escucha, consulta lo que haga falta (pedidos,
 * cotizaciones, calendario…) y contesta con voz. Se ve lo que dijiste, lo que dice
 * Noa y qué tools está usando. Sólo en primer plano (iOS suspende el mic detrás).
 */
export function VoiceLiveBar({ conversationId, onEnd }: VoiceLiveBarProps) {
  const [elapsed, setElapsed] = useState(0);
  const live = useGeminiLive({ onEnd });

  // Auto-start al montar: el montaje viene del tap en "Llamar" (gesto → unlock de audio)
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void live.start(conversationId ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!live.listening) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [live.listening]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") live.stop();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mm = Math.floor(elapsed / 60).toString().padStart(2, "0");
  const ss = (elapsed % 60).toString().padStart(2, "0");

  const statusLabel =
    live.status === "connecting" ? "Conectando…"
    : live.status === "reconnecting" ? "Reconectando…"
    : live.status === "ended" ? "Llamada terminada"
    : live.thinking ? "Noa consulta…"
    : live.speaking ? "Noa habla"
    : "Te escucho";

  const quotaMin = live.quotaSecondsLeft != null ? Math.floor(live.quotaSecondsLeft / 60) : null;
  const lastExchange = live.exchanges[live.exchanges.length - 1];
  const showUser = live.transcriptIn || lastExchange?.user;
  const showNoa = live.transcriptOut || (!live.transcriptIn && lastExchange?.noa);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.18 }}
      className="space-y-2"
      data-testid="voice-live-bar"
    >
      {/* Transcripción: lo tuyo apagado, lo de Noa en blanco */}
      {(showUser || showNoa) && (
        <div className="px-3 py-2 max-h-[140px] overflow-y-auto space-y-1">
          {showUser && (
            <p className="text-[13px] text-white/55 leading-snug">
              <span className="mono text-[10px] uppercase tracking-tight text-white/35 mr-1.5">Vos</span>
              {showUser}
            </p>
          )}
          {showNoa && (
            <p className="text-[15px] text-white/90 leading-snug">
              <span className="mono text-[10px] uppercase tracking-tight text-[var(--color-noa)] mr-1.5">Noa</span>
              {showNoa}
              {live.speaking && (
                <span className="inline-block w-[2px] h-[14px] ml-1 bg-[var(--color-noa)] align-middle animate-pulse" />
              )}
            </p>
          )}
        </div>
      )}

      {/* Tools en curso / hechas */}
      {live.tools.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap px-3">
          {live.tools.map((t) => (
            <Pill
              key={t.id}
              size="sm"
              tone={t.status === "running" ? "noa" : t.ok === false ? "danger" : "neutral"}
              leadingIcon={
                t.status === "running"
                  ? <Loader2 className="size-3 animate-spin" />
                  : t.ok === false ? <Wrench className="size-3" /> : <Check className="size-3" />
              }
              title={t.summary}
            >
              {toolLabel(t.name)}
              {t.ms != null && t.status !== "running" && (
                <span className="mono text-[10px] text-white/45 ml-1">{t.ms < 1000 ? `${t.ms}ms` : `${(t.ms / 1000).toFixed(1)}s`}</span>
              )}
            </Pill>
          ))}
        </div>
      )}

      {live.error && (
        <p className="text-[13px] text-[var(--color-danger)] px-3">{live.error}</p>
      )}

      {/* Barra: colgar · onda · estado · timer */}
      <div
        className={cn(
          "flex items-center gap-2 px-2 py-2",
          "bg-[var(--color-bg-input)] border border-[var(--color-border-hi)]",
          "rounded-[26px]",
          live.listening && "shadow-[0_0_24px_var(--color-noa-glow)]",
        )}
      >
        <button
          onClick={live.status === "ended" ? () => onEnd(live.conversationId) : live.stop}
          aria-label={live.status === "ended" ? "Cerrar" : "Colgar"}
          data-no-focus-ring
          className={cn(
            "size-10 shrink-0 rounded-full flex items-center justify-center",
            "bg-[var(--color-danger)] hover:brightness-110 text-white",
            "transition-colors outline-none border-0",
          )}
        >
          <PhoneOff className="size-4" strokeWidth={2.5} />
        </button>

        <div className="flex-1 min-w-0 flex items-center justify-center px-2">
          <Waveform level={live.level} active={live.listening} noa={live.speaking} />
        </div>

        <div className="flex flex-col items-end shrink-0 leading-none gap-1">
          <span className={cn("mono text-[11px] tracking-tight uppercase",
            live.status === "reconnecting" ? "text-[var(--color-warning)]"
            : live.speaking ? "text-[var(--color-noa)]" : "text-white/55")}>
            {statusLabel}
          </span>
          <span className="mono text-[12px] text-white/75 tracking-tight tabular-nums">
            {mm}:{ss}
            {quotaMin != null && quotaMin < 10 && (
              <span className="text-[var(--color-warning)] ml-1.5">· {quotaMin} min</span>
            )}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

interface WaveformProps {
  level: number;
  active: boolean;
  noa: boolean;
}

function Waveform({ level, active, noa }: WaveformProps) {
  const bars = 34;
  const center = (bars - 1) / 2;
  return (
    <div className="flex items-center justify-center gap-[3px] h-6 w-full">
      {Array.from({ length: bars }).map((_, i) => {
        const distance = Math.abs(i - center) / center;
        const baseHeight = 3;
        let maxHeight = 18;
        if (distance < 0.2) maxHeight = 22;
        else if (distance < 0.4) maxHeight = 16;
        else if (distance < 0.6) maxHeight = 12;
        else maxHeight = 8;
        const variance = ((i * 13 + 7) % 11) / 10;
        const animLevel = active
          ? Math.max(level * (1 - distance * 0.4) * (0.4 + variance * 0.6), 0.08)
          : 0.05;
        const h = baseHeight + animLevel * (maxHeight - baseHeight);
        return (
          <motion.div
            key={i}
            initial={false}
            animate={{ scaleY: h / maxHeight }}
            transition={{ type: "spring", stiffness: 600, damping: 22 }}
            className={cn("w-[2px] rounded-full origin-center", noa ? "bg-[var(--color-noa)]" : "bg-white/85")}
            style={{ height: maxHeight, opacity: active ? 0.6 + animLevel * 0.4 : 0.25 }}
          />
        );
      })}
    </div>
  );
}
