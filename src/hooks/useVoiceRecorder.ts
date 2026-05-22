import { useCallback, useEffect, useRef, useState } from "react";

interface UseVoiceRecorderOpts {
  onTranscript?: (text: string) => void;
  onError?: (error: Error) => void;
  /** Transcribe automáticamente al stop (true) o devolver el Blob (false) */
  autoTranscribe?: boolean;
  /** Función para transcribir el blob (inyectada desde fuera) */
  transcribeFn?: (blob: Blob) => Promise<{ text: string }>;
}

export interface UseVoiceRecorderReturn {
  recording: boolean;
  transcribing: boolean;
  level: number; // 0-1
  error: string | null;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  cancel: () => void;
}

/**
 * useVoiceRecorder — graba audio del micro y opcionalmente transcribe via backend.
 *
 * Usa MediaRecorder + AudioContext analyser para visualizar nivel en realtime.
 * Auto-cleanup al unmount.
 */
export function useVoiceRecorder(opts: UseVoiceRecorderOpts = {}): UseVoiceRecorderReturn {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const cancelledRef = useRef(false);

  const cleanup = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
    setLevel(0);
  }, []);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  const tick = useCallback(() => {
    if (!analyserRef.current) return;
    const buf = new Uint8Array(analyserRef.current.fftSize);
    analyserRef.current.getByteTimeDomainData(buf);
    // RMS
    let sum = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = (buf[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / buf.length);
    setLevel(Math.min(1, rms * 5));
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    cancelledRef.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      src.connect(analyser);
      analyserRef.current = analyser;

      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
      tick();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al acceder al micrófono";
      setError(msg);
      opts.onError?.(err instanceof Error ? err : new Error(msg));
      cleanup();
    }
  }, [tick, cleanup, opts]);

  const stop = useCallback(async () => {
    if (!recorderRef.current || recorderRef.current.state === "inactive") {
      cleanup();
      setRecording(false);
      return;
    }
    return new Promise<void>((resolve) => {
      recorderRef.current!.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setRecording(false);

        if (!cancelledRef.current && opts.autoTranscribe && opts.transcribeFn && blob.size > 0) {
          setTranscribing(true);
          try {
            const { text } = await opts.transcribeFn(blob);
            if (text && text.trim()) opts.onTranscript?.(text.trim());
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Error al transcribir";
            setError(msg);
            opts.onError?.(err instanceof Error ? err : new Error(msg));
          } finally {
            setTranscribing(false);
          }
        }
        cleanup();
        resolve();
      };
      recorderRef.current!.stop();
    });
  }, [opts, cleanup]);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    void stop();
  }, [stop]);

  return { recording, transcribing, level, error, start, stop, cancel };
}
