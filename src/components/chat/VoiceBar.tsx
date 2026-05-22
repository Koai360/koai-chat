import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { X, Check } from "lucide-react";
import { useDeepgramStream } from "@/hooks/useDeepgramStream";
import { cn } from "@/lib/cn";

interface VoiceBarProps {
  /** Llamado con el transcript al confirmar (✓). El texto va al input para editar antes de enviar. */
  onTranscript: (text: string) => void;
  /** Llamado al cancelar (X). */
  onCancel: () => void;
}

/**
 * VoiceBar — recorder inline con transcripción **streaming live** via
 * Deepgram nova-3 (backend WS /api/transcribe/stream).
 *
 * Inspirado en el dictation native de iOS pero integrado al app:
 *   - Mientras hablás, ves el transcript actualizándose abajo de la onda
 *   - X cancela (descarta el transcript)
 *   - ✓ confirma → texto va al input para editar antes de enviar
 *
 * Ventajas sobre Web Speech API:
 *   - Funciona en todos los browsers (Safari iOS, Firefox, etc.)
 *   - Mejor calidad español LATAM (Deepgram nova-3)
 *   - Smart format: puntuación automática, números, fechas
 *   - Endpointing nativo (detecta pausas)
 *   - Filtro anti-alucinación server-side
 */
export function VoiceBar({ onTranscript, onCancel }: VoiceBarProps) {
  const [elapsed, setElapsed] = useState(0);
  const stream = useDeepgramStream({ lang: "es" });

  // Auto-start al montar — UX inmediato sin tap extra
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void stream.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Timer mm:ss
  useEffect(() => {
    if (!stream.listening) return;
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(interval);
  }, [stream.listening]);

  // ESC cancela
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCancel = () => {
    stream.stop();
    onCancel();
  };

  const handleConfirm = () => {
    stream.stop();
    // Pequeño delay para esperar el último 'final' del DG antes de entregar
    setTimeout(() => {
      const text = stream.finalTranscript || stream.transcript;
      if (text.trim()) onTranscript(text.trim());
      else onCancel();
    }, 400);
  };

  const mm = Math.floor(elapsed / 60).toString().padStart(2, "0");
  const ss = (elapsed % 60).toString().padStart(2, "0");

  const hasTranscript = stream.transcript.trim().length > 0;
  const canConfirm = stream.listening && elapsed >= 1 && hasTranscript;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.18 }}
      className="space-y-2"
    >
      {/* Live transcript arriba (siempre visible mientras hay texto) */}
      {hasTranscript && (
        <div className="px-3 py-2 max-h-[120px] overflow-y-auto">
          <p className="text-[15px] text-white/90 leading-snug">
            {stream.transcript}
            {stream.listening && (
              <span className="inline-block w-[2px] h-[14px] ml-1 bg-[var(--color-noa)] align-middle animate-pulse" />
            )}
          </p>
        </div>
      )}

      {/* Hint mientras espera primera palabra */}
      {!hasTranscript && stream.listening && (
        <p className="mono text-[11px] text-white/35 px-3 tracking-tight uppercase">
          Escuchándote…
        </p>
      )}

      {/* Error inline */}
      {stream.error && (
        <p className="text-[13px] text-[var(--color-danger)] px-3">
          {stream.error}
        </p>
      )}

      {/* Bar con waveform + timer + acciones */}
      <div
        className={cn(
          "flex items-center gap-2 px-2 py-2",
          "bg-[var(--color-bg-input)] border border-[var(--color-border-hi)]",
          "rounded-[26px]",
        )}
      >
        {/* Cancel */}
        <button
          onClick={handleCancel}
          aria-label="Cancelar grabación"
          data-no-focus-ring
          className={cn(
            "size-10 shrink-0 rounded-full flex items-center justify-center",
            "bg-white/[0.08] hover:bg-white/[0.15] text-white/85",
            "transition-colors outline-none border-0",
          )}
        >
          <X className="size-4" strokeWidth={2.5} />
        </button>

        {/* Waveform live */}
        <div className="flex-1 min-w-0 flex items-center justify-center px-2">
          <Waveform level={stream.level} active={stream.listening} />
        </div>

        {/* Timer */}
        <span className="mono text-[13px] text-white/75 tracking-tight tabular-nums shrink-0">
          {mm}:{ss}
        </span>

        {/* Confirm */}
        <button
          onClick={handleConfirm}
          aria-label="Confirmar y editar"
          disabled={!canConfirm}
          data-no-focus-ring
          className={cn(
            "size-10 shrink-0 rounded-full flex items-center justify-center",
            "bg-[var(--color-noa)] hover:brightness-110 text-black",
            "transition-all outline-none border-0",
            "disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none",
            canConfirm && "shadow-[0_0_20px_var(--color-noa-glow)]",
          )}
        >
          <Check className="size-4" strokeWidth={3} />
        </button>
      </div>
    </motion.div>
  );
}

interface WaveformProps {
  level: number;
  active: boolean;
}

function Waveform({ level, active }: WaveformProps) {
  const bars = 38;
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
            animate={{ height: h }}
            transition={{ type: "spring", stiffness: 600, damping: 22 }}
            className="w-[2px] rounded-full bg-white/85"
            style={{
              opacity: active ? 0.6 + animLevel * 0.4 : 0.25,
            }}
          />
        );
      })}
    </div>
  );
}
