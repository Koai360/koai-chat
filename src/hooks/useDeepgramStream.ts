import { useCallback, useEffect, useRef, useState } from "react";
import { getAuthToken } from "@/lib/api";

// P2-13 audit: mapping de errores comunes de getUserMedia a copy ES.
// Estos `name` son los DOMException estándar emitidos por el browser.
const LOCALIZED_MEDIA_ERRORS: Record<string, string> = {
  NotFoundError: "No encontramos ningún micrófono conectado.",
  DevicesNotFoundError: "No encontramos ningún micrófono conectado.",
  NotAllowedError:
    "Necesitamos permiso para acceder al micrófono. Activá el permiso en la configuración del navegador.",
  PermissionDeniedError:
    "Necesitamos permiso para acceder al micrófono. Activá el permiso en la configuración del navegador.",
  NotReadableError:
    "El micrófono está siendo usado por otra app. Cerrá las demás llamadas o grabaciones e intentá de nuevo.",
  TrackStartError:
    "El micrófono está siendo usado por otra app. Cerrá las demás llamadas o grabaciones e intentá de nuevo.",
  OverconstrainedError:
    "Tu micrófono no soporta la configuración requerida. Probá con otro dispositivo.",
  ConstraintNotSatisfiedError:
    "Tu micrófono no soporta la configuración requerida. Probá con otro dispositivo.",
  SecurityError: "El navegador bloqueó el acceso al micrófono por seguridad (¿la página es HTTP?).",
  AbortError: "La grabación fue interrumpida.",
};

/**
 * useDeepgramStream — transcripción en vivo via WebSocket proxy del backend.
 *
 * El backend (WS /api/transcribe/stream) hace proxy a Deepgram nova-3 con
 * interim_results + smart_format + endpointing. Funciona en TODOS los browsers
 * porque no depende de Web Speech API (que es flaky en Safari iOS y Firefox no
 * la tiene).
 *
 * Flow:
 *   1. open WebSocket
 *   2. getUserMedia mic + AudioContext analyser para el waveform
 *   3. MediaRecorder.ondataavailable → ws.send(chunk binario)
 *   4. ws.onmessage {type: partial|final, text} → update transcript state
 *   5. stop: ws.send("stop") + cleanup
 *
 * Estados:
 *   - listening: grabando + conectado
 *   - transcript: final + interim concatenado (display)
 *   - finalTranscript: solo final confirmed (lo que sobrevive a la pausa)
 *   - level: 0-1 RMS del mic para visualizer
 *   - error: mensaje si falla
 */

const API_BASE = import.meta.env.VITE_API_BASE || "https://api.koai360.com";

interface UseDeepgramStreamOpts {
  lang?: string;
  onFinal?: (text: string) => void;
}

export interface UseDeepgramStreamReturn {
  supported: boolean;
  listening: boolean;
  transcript: string;
  finalTranscript: string;
  level: number;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
  reset: () => void;
}

function pickAudioMime(): string {
  // Preferencia: webm/opus (Chrome/Firefox/Edge), fallback mp4 (Safari iOS)
  if (typeof MediaRecorder === "undefined") return "audio/webm";
  if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) return "audio/webm;codecs=opus";
  if (MediaRecorder.isTypeSupported("audio/webm")) return "audio/webm";
  if (MediaRecorder.isTypeSupported("audio/mp4")) return "audio/mp4";
  if (MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")) return "audio/ogg;codecs=opus";
  return "audio/webm";
}

function wsUrl(path: string): string {
  // Convierte https://api.koai360.com → wss://api.koai360.com
  const base = API_BASE.replace(/^https:/i, "wss:").replace(/^http:/i, "ws:");
  return `${base}${path}`;
}

export function useDeepgramStream(opts: UseDeepgramStreamOpts = {}): UseDeepgramStreamReturn {
  const supported =
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    typeof WebSocket !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia;

  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const finalRef = useRef("");
  const interimRef = useRef("");

  const cleanup = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    try {
      // P2-4 audit: usar if statement en vez de && para control flow.
      const rec = recorderRef.current;
      if (rec && rec.state !== "inactive") rec.stop();
    } catch {
      /* noop */
    }
    recorderRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    try {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send("stop");
      }
      wsRef.current?.close();
    } catch {
      /* noop */
    }
    wsRef.current = null;
    setLevel(0);
  }, []);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  // P2-4 + P3-7 audit:
  //  - antes: useCallback con auto-referencia a `tick` (react-hooks/exhaustive-deps).
  //  - antes: alocaba Uint8Array cada frame (GC churn ~60Hz durante grabación).
  // Ahora: function declaration (no es hook → sin issues de deps) + buffer reusado.
  const tickBufRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  function tick(): void {
    const analyser = analyserRef.current;
    if (!analyser) return;
    if (!tickBufRef.current || tickBufRef.current.length !== analyser.fftSize) {
      tickBufRef.current = new Uint8Array(new ArrayBuffer(analyser.fftSize));
    }
    const buf = tickBufRef.current;
    analyser.getByteTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = (buf[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / buf.length);
    setLevel(Math.min(1, rms * 5));
    rafRef.current = requestAnimationFrame(tick);
  }

  const start = useCallback(async () => {
    if (!supported) {
      setError("Tu navegador no soporta grabación de audio.");
      return;
    }
    setError(null);
    setTranscript("");
    setFinalTranscript("");
    finalRef.current = "";
    interimRef.current = "";

    // 1. Mic stream
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
    } catch (err) {
      // P2-13 audit: mapear errores comunes de getUserMedia a copy ES legible.
      // El default `err.message` del browser viene en inglés técnico
      // ("Requested device not found"), inaceptable en una app en español.
      const name = (err as { name?: string })?.name ?? "";
      const localized = LOCALIZED_MEDIA_ERRORS[name];
      const msg =
        localized ??
        (err instanceof Error ? err.message : "No pudimos acceder al micrófono.");
      setError(msg);
      return;
    }

    // 2. Audio analyser para visualizer
    try {
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      src.connect(analyser);
      analyserRef.current = analyser;
      tick();
    } catch (err) {
      console.warn("[useDeepgramStream] analyser failed", err);
      // No es fatal — sin visualizer pero la transcripción sigue
    }

    // 3. WebSocket al backend (Deepgram Flux v2 multilingual por default)
    const mime = pickAudioMime();
    const token = getAuthToken();
    const params = new URLSearchParams({
      mime,
      lang: opts.lang || "es",
      model: "flux", // purpose-built voice agents, multilingual, sub-200ms EOT
    });
    if (token) params.set("token", token);
    const url = wsUrl(`/api/transcribe/stream?${params}`);
    const ws = new WebSocket(url);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    const opened = new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("timeout abriendo WebSocket")), 8000);
      ws.addEventListener("open", () => {
        clearTimeout(t);
        resolve();
      });
      ws.addEventListener("error", () => {
        clearTimeout(t);
        reject(new Error("error abriendo WebSocket"));
      });
    });

    try {
      await opened;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error de conexión";
      setError(msg);
      cleanup();
      return;
    }

    ws.addEventListener("message", (event) => {
      try {
        const data = JSON.parse(event.data as string);
        if (data.type === "partial" && typeof data.text === "string") {
          interimRef.current = data.text;
          setTranscript((finalRef.current + " " + data.text).trim());
        } else if (data.type === "final" && typeof data.text === "string") {
          finalRef.current = (finalRef.current + " " + data.text).trim();
          interimRef.current = "";
          setFinalTranscript(finalRef.current);
          setTranscript(finalRef.current);
        } else if (data.type === "error") {
          console.warn("[useDeepgramStream] backend error", data.message);
          if (data.message) setError(data.message);
        }
      } catch {
        /* ignore non-JSON */
      }
    });

    ws.addEventListener("close", () => {
      setListening(false);
      if (opts.onFinal && finalRef.current.trim()) {
        opts.onFinal(finalRef.current.trim());
      }
    });

    // 4. MediaRecorder envía chunks al WS cada 250ms
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType: mime });
    } catch {
      // Fallback sin mimeType si el específico falla
      recorder = new MediaRecorder(stream);
    }
    recorderRef.current = recorder;

    recorder.ondataavailable = async (e) => {
      if (!e.data || e.data.size === 0) return;
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
      try {
        const buf = await e.data.arrayBuffer();
        wsRef.current.send(buf);
      } catch (err) {
        console.warn("[useDeepgramStream] send chunk failed", err);
      }
    };

    recorder.start(250); // emit chunk cada 250ms para low latency
    setListening(true);
  }, [supported, opts, tick, cleanup]);

  const stop = useCallback(() => {
    setListening(false);
    // Send "stop" para CloseStream limpio en Deepgram (lo flushea el último audio)
    try {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send("stop");
      }
    } catch {
      /* noop */
    }
    // Pequeño delay para que llegue el último final del DG antes de cerrar
    setTimeout(() => {
      cleanup();
    }, 350);
  }, [cleanup]);

  const reset = useCallback(() => {
    setTranscript("");
    setFinalTranscript("");
    finalRef.current = "";
    interimRef.current = "";
    setError(null);
  }, []);

  return {
    supported,
    listening,
    transcript,
    finalTranscript,
    level,
    error,
    start,
    stop,
    reset,
  };
}
