import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { X, Check } from "lucide-react";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { transcribeAudio } from "@/lib/api";
import { cn } from "@/lib/cn";

interface VoiceBarProps {
  /** Llamado con el transcript al confirmar (✓). */
  onTranscript: (text: string) => void;
  /** Llamado al cancelar (X) — vuelve al input normal. */
  onCancel: () => void;
}

/**
 * VoiceBar — recorder inline que reemplaza el input pill mientras se graba.
 *
 * Layout (mismo tamaño que el pill input):
 *   [ X ]   ····||||······||·····|||   0:02   [ ✓ ]
 *
 * Auto-start al montar. Cancelar (X) o confirmar (✓) terminan el flow.
 * Confirmar dispara transcribeAudio → callback onTranscript.
 */
export function VoiceBar({ onTranscript, onCancel }: VoiceBarProps) {
  const [elapsed, setElapsed] = useState(0);

  const recorder = useVoiceRecorder({
    autoTranscribe: true,
    transcribeFn: transcribeAudio,
    onTranscript: (text) => {
      if (text.trim()) onTranscript(text.trim());
    },
  });

  // Auto-start al montar
  useEffect(() => {
    void recorder.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Timer mm:ss
  useEffect(() => {
    if (!recorder.recording) return;
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(interval);
  }, [recorder.recording]);

  // ESC para cancelar
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCancel = () => {
    recorder.cancel();
    onCancel();
  };

  const handleConfirm = () => {
    void recorder.stop();
    // onTranscript dispara en el callback del recorder (autoTranscribe=true)
  };

  const mm = Math.floor(elapsed / 60).toString().padStart(2, "0");
  const ss = (elapsed % 60).toString().padStart(2, "0");

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.18 }}
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
        <Waveform level={recorder.level} active={recorder.recording} transcribing={recorder.transcribing} />
      </div>

      {/* Timer */}
      <span className="mono text-[13px] text-white/75 tracking-tight tabular-nums shrink-0">
        {mm}:{ss}
      </span>

      {/* Confirm */}
      <button
        onClick={handleConfirm}
        aria-label="Enviar audio"
        disabled={recorder.transcribing || elapsed < 1}
        data-no-focus-ring
        className={cn(
          "size-10 shrink-0 rounded-full flex items-center justify-center",
          "bg-[var(--color-noa)] hover:brightness-110 text-black",
          "transition-all outline-none border-0",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "shadow-[0_0_20px_var(--color-noa-glow)]",
        )}
      >
        {recorder.transcribing ? (
          <span className="size-4 rounded-full border-2 border-black border-t-transparent animate-spin" />
        ) : (
          <Check className="size-4" strokeWidth={3} />
        )}
      </button>
    </motion.div>
  );
}

interface WaveformProps {
  level: number;
  active: boolean;
  transcribing: boolean;
}

/**
 * Waveform horizontal compacto. ~38 barras: 8 pequeñas + 22 grandes alternadas
 * + 8 pequeñas. La barra central refleja el `level` (RMS), las demás varían
 * con spring fade-out simulando memoria del audio.
 */
function Waveform({ level, active, transcribing }: WaveformProps) {
  const bars = 38;
  const center = (bars - 1) / 2;

  return (
    <div className="flex items-center justify-center gap-[3px] h-6 w-full">
      {Array.from({ length: bars }).map((_, i) => {
        const distance = Math.abs(i - center) / center;
        const baseHeight = 3;
        let maxHeight = 18;

        // Más altas las centrales (visual "anchor")
        if (distance < 0.2) maxHeight = 22;
        else if (distance < 0.4) maxHeight = 16;
        else if (distance < 0.6) maxHeight = 12;
        else maxHeight = 8;

        // Pseudo-random variation usando index para evitar Math.random
        const variance = ((i * 13 + 7) % 11) / 10;
        const animLevel = active
          ? Math.max(level * (1 - distance * 0.4) * (0.4 + variance * 0.6), 0.08)
          : transcribing
          ? 0.3
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
              opacity: active ? 0.6 + animLevel * 0.4 : transcribing ? 0.4 : 0.25,
            }}
          />
        );
      })}
    </div>
  );
}
