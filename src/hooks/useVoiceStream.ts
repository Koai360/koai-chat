import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useVoiceStream — graba audio y lo envía al backend WebSocket proxy que
 * forwardea a Deepgram nova-3 streaming. Recibe transcripts parciales y
 * finales en tiempo real mientras el usuario habla.
 *
 * Estados:
 *  - idle: sin grabar
 *  - recording: grabando + enviando chunks al WS
 *  - transcribing: el user paró y esperamos el último final del server
 *  - error: algo falló (ver `error` state)
 *
 * El texto final acumulado se devuelve vía `onFinal` callback cuando el user
 * llama a `stop()`. El texto parcial live (interim) se devuelve vía
 * `partialText` state para display en tiempo real.
 *
 * Waveform: expone `getAmplitude()` que retorna un valor 0..1 basado en
 * AnalyserNode del stream del mic. El componente que renderiza el waveform
 * puede llamarlo en cada frame para animar.
 */

const API_URL = import.meta.env.VITE_API_URL || "https://api.koai360.com";
const WS_URL = API_URL.replace(/^http/, "ws");
const MAX_RECORDING_SECONDS = 120;

export type VoiceStreamState = "idle" | "recording" | "transcribing" | "error";

export interface UseVoiceStreamOptions {
  onFinal: (text: string) => void;
  onError?: (err: string) => void;
  lang?: string;
}

export function useVoiceStream({ onFinal, onError, lang = "es" }: UseVoiceStreamOptions) {
  const [state, setState] = useState<VoiceStreamState>("idle");
  const [partialText, setPartialText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalsRef = useRef<string[]>([]);
  const cancelledRef = useRef(false);
  const partialRef = useRef("");
  const stoppingRef = useRef(false);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (stopTimeoutRef.current) {
      clearTimeout(stopTimeoutRef.current);
      stopTimeoutRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try { mediaRecorderRef.current.stop(); } catch { /* ignore */ }
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    if (wsRef.current) {
      try {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send("stop");
          wsRef.current.close();
        }
      } catch { /* ignore */ }
      wsRef.current = null;
    }
    mediaRecorderRef.current = null;
    setElapsedSec(0);
  }, []);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  const getAmplitude = useCallback((): number => {
    const analyser = analyserRef.current;
    if (!analyser) return 0;
    const buf = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(buf);
    // RMS para obtener amplitud promedio
    let sum = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = (buf[i] - 128) / 128;
      sum += v * v;
    }
    return Math.min(1, Math.sqrt(sum / buf.length) * 2.5); // normalizado y boost visual
  }, []);

  const start = useCallback(async () => {
    if (state !== "idle") return;
    setError(null);
    setPartialText("");
    finalsRef.current = [];
    cancelledRef.current = false;

    try {
      // 1. Request mic access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      });
      streamRef.current = stream;

      // 2. Setup AudioContext + AnalyserNode para waveform
      try {
        const AudioCtor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const audioCtx = new AudioCtor();
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.5;
        source.connect(analyser);
        audioCtxRef.current = audioCtx;
        analyserRef.current = analyser;
      } catch {
        // Waveform es nice-to-have, no bloqueante
      }

      // 3. Pick best supported mime type
      let mimeType = "";
      for (const candidate of [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ]) {
        try {
          if (MediaRecorder.isTypeSupported(candidate)) {
            mimeType = candidate;
            break;
          }
        } catch { /* ignore */ }
      }

      // 4. Open WebSocket to our backend proxy
      const wsParams = new URLSearchParams({
        mime: mimeType || "audio/webm",
        lang,
      });
      const ws = new WebSocket(`${WS_URL}/api/transcribe/stream?${wsParams}`);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      // Esperar a que el WS abra antes de empezar a grabar
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("WebSocket timeout")), 5000);
        ws.onopen = () => {
          clearTimeout(timeout);
          resolve();
        };
        ws.onerror = () => {
          clearTimeout(timeout);
          reject(new Error("WebSocket error"));
        };
      });

      // Manejo de mensajes del server
      ws.onmessage = (evt) => {
        if (cancelledRef.current) return;
        try {
          const data = JSON.parse(evt.data);
          if (data.type === "partial") {
            partialRef.current = data.text;
            setPartialText(data.text);
          } else if (data.type === "final") {
            finalsRef.current.push(data.text);
            partialRef.current = "";
            setPartialText(""); // limpia el interim cuando llega un final
          } else if (data.type === "error") {
            setError(data.message || "Error de transcripción");
            if (onError) onError(data.message);
          } else if (data.type === "done") {
            // Server confirma cierre — resolver el stop si estábamos esperando
            if (stoppingRef.current && !cancelledRef.current) {
              const combined = [...finalsRef.current, partialRef.current]
                .filter(Boolean)
                .join(" ")
                .trim();
              if (combined) onFinal(combined);
              cleanup();
              setState("idle");
              setPartialText("");
              stoppingRef.current = false;
            }
          }
        } catch { /* ignore */ }
      };

      ws.onclose = () => {
        // Si estábamos esperando la finalización del stop, entregar resultado
        if (stoppingRef.current && !cancelledRef.current) {
          const combined = [...finalsRef.current, partialRef.current]
            .filter(Boolean)
            .join(" ")
            .trim();
          if (combined) onFinal(combined);
          setState("idle");
          setPartialText("");
          stoppingRef.current = false;
        }
      };

      ws.onerror = () => {
        setError("Conexión perdida");
        if (onError) onError("Conexión perdida");
      };

      // 5. Start recording
      const recorderOpts: MediaRecorderOptions = {};
      if (mimeType) recorderOpts.mimeType = mimeType;
      const recorder = new MediaRecorder(stream, recorderOpts);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
          e.data.arrayBuffer().then((buf) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(buf);
            }
          });
        }
      };

      recorder.onstop = () => {
        // MediaRecorder paró — decirle al WS que cierre
        if (ws.readyState === WebSocket.OPEN) {
          try { ws.send("stop"); } catch { /* ignore */ }
        }
      };

      // Timeslice 100ms — envía chunks pequeños y frecuentes para baja latencia
      recorder.start(100);

      // Timer elapsed
      timerRef.current = setInterval(() => {
        setElapsedSec((p) => {
          const next = p + 1;
          if (next >= MAX_RECORDING_SECONDS) {
            // Auto-stop al llegar al límite
            stopInternal(false);
          }
          return next;
        });
      }, 1000);

      setState("recording");
      if (navigator.vibrate) navigator.vibrate(15);
    } catch (err) {
      cleanup();
      const msg = err instanceof Error ? err.message : "No se pudo iniciar grabación";
      setError(msg);
      setState("error");
      if (onError) onError(msg);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, lang, onFinal, onError, cleanup]);

  const stopInternal = useCallback((cancel: boolean) => {
    cancelledRef.current = cancel;
    if (cancel) {
      cleanup();
      setState("idle");
      setPartialText("");
      finalsRef.current = [];
      partialRef.current = "";
      stoppingRef.current = false;
      return;
    }

    stoppingRef.current = true;
    setState("transcribing");

    // Stop MediaRecorder (dispara onstop → WS stop)
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try { mediaRecorderRef.current.stop(); } catch { /* ignore */ }
    }

    // Timeout de seguridad — si el WS no cierra en 3s, forzar finalización
    stopTimeoutRef.current = setTimeout(() => {
      if (!stoppingRef.current) return; // ya se entregó el final
      const combined = [...finalsRef.current, partialRef.current]
        .filter(Boolean)
        .join(" ")
        .trim();
      if (combined && !cancelledRef.current) {
        onFinal(combined);
      }
      cleanup();
      setState("idle");
      setPartialText("");
      stoppingRef.current = false;
    }, 3000);
  }, [cleanup, onFinal]);

  const stop = useCallback(() => stopInternal(false), [stopInternal]);
  const cancel = useCallback(() => stopInternal(true), [stopInternal]);

  return {
    state,
    partialText,
    error,
    elapsedSec,
    start,
    stop,
    cancel,
    getAmplitude,
  };
}
