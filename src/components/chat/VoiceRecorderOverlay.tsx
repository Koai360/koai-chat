import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check } from "lucide-react";

/**
 * VoiceRecorderOverlay — se muestra mientras el user está grabando.
 *
 * Features:
 * - Waveform visualizer animado con la amplitud real del mic
 * - Contador de tiempo mm:ss
 * - Partial text live (lo que va transcribiendo Deepgram)
 * - Botón cancel (X rojo) — descarta todo
 * - Botón send (check verde) — finaliza y envía al input
 */

interface Props {
  isVisible: boolean;
  elapsedSec: number;
  partialText: string;
  getAmplitude: () => number;
  onCancel: () => void;
  onStop: () => void;
}

const BAR_COUNT = 32;
const MAX_BAR_HEIGHT = 36;
const MIN_BAR_HEIGHT = 3;

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function VoiceRecorderOverlay({
  isVisible,
  elapsedSec,
  partialText,
  getAmplitude,
  onCancel,
  onStop,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const historyRef = useRef<number[]>([]);

  useEffect(() => {
    if (!isVisible) {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      historyRef.current = [];
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const barWidth = width / BAR_COUNT;
    const gap = 2;

    const draw = () => {
      const amp = getAmplitude();
      historyRef.current.push(amp);
      if (historyRef.current.length > BAR_COUNT) {
        historyRef.current.shift();
      }

      ctx.clearRect(0, 0, width, height);

      const centerY = height / 2;
      const bars = historyRef.current;
      const offset = BAR_COUNT - bars.length;

      for (let i = 0; i < BAR_COUNT; i++) {
        const dataIdx = i - offset;
        const value = dataIdx >= 0 ? bars[dataIdx] : 0;
        const barHeight = Math.max(MIN_BAR_HEIGHT, value * MAX_BAR_HEIGHT);
        const x = i * barWidth + gap / 2;
        const y = centerY - barHeight / 2;
        const w = barWidth - gap;

        // Gradient verde noa con más intensidad en bars recientes (derecha)
        const alpha = 0.4 + (dataIdx / BAR_COUNT) * 0.6;
        ctx.fillStyle = `rgba(212, 233, 75, ${Math.max(0.3, alpha)})`;
        ctx.fillRect(x, y, w, barHeight);
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isVisible, getAmplitude]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-x-0 bottom-0 z-50 px-4 pt-3 pb-2"
          style={{
            background: "linear-gradient(to top, rgba(10,10,12,0.98) 70%, rgba(10,10,12,0.8) 100%)",
            backdropFilter: "blur(12px)",
          }}
        >
          <div className="max-w-[48rem] mx-auto w-full">
            {/* Partial text (lo que va transcribiendo) */}
            {partialText && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mb-2 px-3 py-1.5 text-[13px] text-text-muted font-medium italic line-clamp-2"
              >
                {partialText}
              </motion.div>
            )}

            {/* Main row: cancel + waveform + timer + send */}
            <div className="flex items-center gap-3 bg-bg-surface/90 border border-border rounded-full px-3 py-2">
              {/* Cancel button — rojo */}
              <button
                onClick={onCancel}
                aria-label="Cancelar grabación"
                className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center bg-danger/15 active:bg-danger/30 transition-colors"
              >
                <X className="w-[18px] h-[18px] text-danger" strokeWidth={2.5} />
              </button>

              {/* Waveform */}
              <div className="flex-1 flex items-center gap-2 min-w-0">
                <canvas
                  ref={canvasRef}
                  className="flex-1 h-9"
                  style={{ imageRendering: "pixelated" }}
                />
                <span className="font-mono text-[11px] text-text shrink-0 tabular-nums">
                  {formatTime(elapsedSec)}
                </span>
              </div>

              {/* Send/Stop button — verde noa */}
              <button
                onClick={onStop}
                aria-label="Enviar grabación"
                className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-colors"
                style={{
                  backgroundColor: "var(--color-noa)",
                  color: "#000000",
                }}
              >
                <Check className="w-[18px] h-[18px]" strokeWidth={3} />
              </button>
            </div>

            {/* Hint sutil */}
            <div className="mt-1.5 text-center text-[10px] text-text-subtle font-mono">
              Grabando... toca ✓ para enviar
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
