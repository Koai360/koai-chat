import { useCallback, useEffect, useRef, useState } from "react";
import { API_URL, API_KEY, getAuthToken } from "../config";

/**
 * useRealtimeTranslate — sesión WebRTC contra OpenAI gpt-realtime-translate.
 *
 * Flow: mint ephemeral token via koai-api → getUserMedia → RTCPeerConnection
 *   con un audio sender + datachannel para eventos → SDP exchange directo
 *   contra https://api.openai.com/v1/realtime/translations/calls →
 *   pc.ontrack reproduce el audio traducido en el <audio> element.
 *
 * El modelo es 1-vía: setea `targetLanguage` (idioma destino), detecta el
 * idioma origen automáticamente y entrega audio + transcript en el destino.
 */

export type TranslateState =
  | "disconnected"
  | "connecting"
  | "idle"
  | "listening"
  | "translating"
  | "speaking"
  | "error";

interface UseRealtimeTranslateOptions {
  targetLanguage: string;
  audioElement: HTMLAudioElement | null;
  maxSessionSeconds?: number; // auto-disconnect
  onError?: (err: string) => void;
}

const DEFAULT_MAX_SESSION = 15 * 60; // 15 min

function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  else headers["X-API-Key"] = API_KEY;
  return headers;
}

export function useRealtimeTranslate({
  targetLanguage,
  audioElement,
  maxSessionSeconds = DEFAULT_MAX_SESSION,
  onError,
}: UseRealtimeTranslateOptions) {
  const [state, setState] = useState<TranslateState>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const [sourceText, setSourceText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [elapsedSec, setElapsedSec] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [muted, setMuted] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const meterCleanupRef = useRef<(() => void) | null>(null);
  const sourceDeltaRef = useRef("");
  const translatedDeltaRef = useRef("");

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (meterCleanupRef.current) {
      meterCleanupRef.current();
      meterCleanupRef.current = null;
    }
    try {
      dcRef.current?.close();
    } catch {
      /* noop */
    }
    try {
      pcRef.current?.close();
    } catch {
      /* noop */
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    pcRef.current = null;
    dcRef.current = null;
    streamRef.current = null;
    setAudioLevel(0);
    setMuted(false);
    setElapsedSec(0);
  }, []);

  const disconnect = useCallback(() => {
    cleanup();
    setState("disconnected");
    setSourceText("");
    setTranslatedText("");
    sourceDeltaRef.current = "";
    translatedDeltaRef.current = "";
  }, [cleanup]);

  // unmount safety
  useEffect(() => () => cleanup(), [cleanup]);

  const handleEvent = useCallback((event: { type: string; [k: string]: unknown }) => {
    const t = event.type;

    // session lifecycle
    if (t === "session.created" || t === "session.updated") return;

    // turn detection — user habla
    if (t === "input_audio_buffer.speech_started") {
      setState("listening");
      return;
    }
    if (t === "input_audio_buffer.speech_stopped") {
      setState("translating");
      return;
    }

    // audio output — modelo habla
    if (t === "response.output_audio.delta" || t === "response.audio.delta") {
      setState("speaking");
      return;
    }
    if (t === "response.done") {
      setState("idle");
      return;
    }

    // source language transcript (lo que dijo el user, en idioma origen)
    if (t === "response.input_audio_transcription.delta" || t === "conversation.item.input_audio_transcription.delta") {
      const delta = (event.delta as string) || "";
      sourceDeltaRef.current += delta;
      setSourceText(sourceDeltaRef.current);
      return;
    }
    if (
      t === "response.input_audio_transcription.completed" ||
      t === "conversation.item.input_audio_transcription.completed"
    ) {
      const transcript = (event.transcript as string) || sourceDeltaRef.current;
      if (transcript) setSourceText(transcript);
      sourceDeltaRef.current = "";
      return;
    }

    // translated transcript (output del modelo en idioma destino)
    if (t === "response.output_audio_transcript.delta" || t === "response.audio_transcript.delta") {
      const delta = (event.delta as string) || "";
      translatedDeltaRef.current += delta;
      setTranslatedText(translatedDeltaRef.current);
      return;
    }
    if (t === "response.output_audio_transcript.done" || t === "response.audio_transcript.done") {
      const transcript = (event.transcript as string) || translatedDeltaRef.current;
      if (transcript) setTranslatedText(transcript);
      translatedDeltaRef.current = "";
      return;
    }

    if (t === "error") {
      const message = ((event.error as { message?: string })?.message) || "Realtime error";
      setError(message);
      setState("error");
      if (onError) onError(message);
    }
  }, [onError]);

  const connect = useCallback(async () => {
    if (state !== "disconnected" && state !== "error") return;
    setError(null);
    setSourceText("");
    setTranslatedText("");
    sourceDeltaRef.current = "";
    translatedDeltaRef.current = "";
    setState("connecting");

    try {
      // 1. mint ephemeral
      const tokenRes = await fetch(`${API_URL}/api/realtime-translate/session`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ target_language: targetLanguage }),
      });
      if (!tokenRes.ok) {
        const body = await tokenRes.text().catch(() => "");
        throw new Error(`Session endpoint ${tokenRes.status}: ${body.slice(0, 200)}`);
      }
      const tokenData = await tokenRes.json();
      const ephemeralKey: string | undefined = tokenData?.value;
      if (!ephemeralKey) throw new Error("No ephemeral key returned");

      // 2. setup pc + mic
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      if (audioElement) {
        pc.ontrack = (ev) => {
          audioElement.srcObject = ev.streams[0];
          meterCleanupRef.current = attachLevelMeter(ev.streams[0], setAudioLevel);
        };
      }

      const ms = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = ms;
      ms.getTracks().forEach((track) => pc.addTrack(track, ms));

      // 3. data channel
      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;
      dc.addEventListener("open", () => {
        setState("idle");
      });
      dc.addEventListener("message", (ev) => {
        try {
          const event = JSON.parse(ev.data);
          handleEvent(event);
        } catch {
          /* noop */
        }
      });
      dc.addEventListener("close", () => {
        setState((s) => (s === "error" ? s : "disconnected"));
      });

      // 4. SDP exchange
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // gpt-realtime-translate tiene endpoint SDP dedicado bajo /translations/.
      // El modelo va implícito en el ephemeral key (minted como type=translation).
      const sdpRes = await fetch(
        "https://api.openai.com/v1/realtime/translations/calls",
        {
          method: "POST",
          body: offer.sdp,
          headers: {
            Authorization: `Bearer ${ephemeralKey}`,
            "Content-Type": "application/sdp",
          },
        }
      );
      if (!sdpRes.ok) {
        const body = await sdpRes.text().catch(() => "");
        throw new Error(`SDP ${sdpRes.status}: ${body.slice(0, 200)}`);
      }
      const answerSdp = await sdpRes.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

      // 5. timer + auto-disconnect
      timerRef.current = setInterval(() => {
        setElapsedSec((s) => {
          const next = s + 1;
          if (next >= maxSessionSeconds) {
            disconnect();
          }
          return next;
        });
      }, 1000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Connection failed";
      console.error("[useRealtimeTranslate]", msg);
      setError(msg);
      setState("error");
      cleanup();
      if (onError) onError(msg);
    }
  }, [state, targetLanguage, audioElement, maxSessionSeconds, handleEvent, cleanup, disconnect, onError]);

  const toggleMute = useCallback(() => {
    const ms = streamRef.current;
    if (!ms) return;
    const next = !muted;
    ms.getAudioTracks().forEach((t) => (t.enabled = !next));
    setMuted(next);
  }, [muted]);

  return {
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
  };
}

function attachLevelMeter(stream: MediaStream, onLevel: (level: number) => void): () => void {
  try {
    const AudioCtor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtor();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    const buf = new Uint8Array(analyser.frequencyBinCount);
    let raf = 0;
    const loop = () => {
      analyser.getByteFrequencyData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i];
      onLevel(sum / buf.length / 255);
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      cancelAnimationFrame(raf);
      ctx.close().catch(() => {});
    };
  } catch {
    return () => {};
  }
}
