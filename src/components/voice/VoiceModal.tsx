import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mic } from "lucide-react";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { transcribeAudio } from "@/lib/api";
import { Button } from "@/components/ui/Button";

interface VoiceModalProps {
  open: boolean;
  onClose: () => void;
  onTranscript: (text: string) => void;
}

/**
 * VoiceModal — fullscreen overlay para grabación de voz.
 *
 * Layout vertical: ✕ top right · waveform centro · transcript live · Cancelar
 *
 * Auto-start cuando se abre, auto-stop al cerrar/cancelar.
 */
export function VoiceModal({ open, onClose, onTranscript }: VoiceModalProps) {
  const [transcript, setTranscript] = useState("");

  const recorder = useVoiceRecorder({
    autoTranscribe: true,
    transcribeFn: transcribeAudio,
    onTranscript: (text) => {
      setTranscript(text);
      onTranscript(text);
      onClose();
    },
  });

  // Auto-start al abrir
  useEffect(() => {
    if (open) {
      setTranscript("");
      recorder.start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleClose = () => {
    if (recorder.recording) recorder.cancel();
    onClose();
  };

  const handleStopAndSend = () => {
    void recorder.stop();
  };

  // Escape to cancel
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6"
          style={{
            background:
              "radial-gradient(ellipse 100% 80% at 50% 100%, rgba(76, 29, 149, 0.35) 0%, rgba(0, 0, 0, 0.92) 60%, rgba(0, 0, 0, 0.98) 100%)",
            backdropFilter: "blur(40px)",
          }}
        >
          <button
            onClick={handleClose}
            className="absolute top-6 right-6 size-11 rounded-full bg-white/[0.08] hover:bg-white/[0.16] backdrop-blur-sm flex items-center justify-center transition"
            aria-label="Cerrar"
          >
            <X className="size-5 text-white" />
          </button>

          {/* Visualizer */}
          <div className="flex flex-col items-center text-center max-w-md">
            <Waveform level={recorder.level} active={recorder.recording} />

            <p className="display text-[20px] md:text-[24px] text-white/95 mt-8 mb-2">
              {recorder.transcribing
                ? "Transcribiendo…"
                : recorder.recording
                ? "Te escucho…"
                : recorder.error
                ? "Error"
                : "Listo"}
            </p>

            {recorder.error && (
              <p className="text-[14px] text-[var(--color-danger)] mb-2">{recorder.error}</p>
            )}

            {transcript && (
              <p className="text-[15px] text-white/80 italic max-w-sm">"{transcript}"</p>
            )}
          </div>

          {/* Actions */}
          <div className="absolute bottom-12 flex items-center gap-3">
            <Button variant="ghost" size="lg" onClick={handleClose}>
              Cancelar
            </Button>
            {recorder.recording && (
              <Button variant="primary" size="lg" onClick={handleStopAndSend}>
                Enviar
              </Button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface WaveformProps {
  level: number;
  active: boolean;
}

function Waveform({ level, active }: WaveformProps) {
  const bars = 20;
  return (
    <div className="flex items-center justify-center gap-1.5 h-[100px]">
      {Array.from({ length: bars }).map((_, i) => {
        // Distribución estilo "bell curve" centrado
        const distance = Math.abs(i - (bars - 1) / 2) / ((bars - 1) / 2);
        const factor = 1 - distance * 0.5;
        const minHeight = 6;
        const maxHeight = 80 * factor;
        const animLevel = active ? Math.max(level * factor, 0.05) : 0.05;
        const h = minHeight + animLevel * (maxHeight - minHeight);
        return (
          <motion.div
            key={i}
            initial={false}
            animate={{ height: h }}
            transition={{ type: "spring", stiffness: 500, damping: 25 }}
            className="w-1.5 rounded-full"
            style={{
              background: active ? "var(--color-noa)" : "rgba(255,255,255,0.15)",
              boxShadow: active ? "0 0 12px rgba(200, 221, 74, 0.35)" : "none",
            }}
          />
        );
      })}
    </div>
  );
}

// Mic icon export por si se necesita aislado
export { Mic };
