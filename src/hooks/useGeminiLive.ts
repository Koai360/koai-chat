import { useCallback, useEffect, useRef, useState } from "react";
import { getAuthToken, handleUnauthorized, isJwtExpired } from "@/lib/api";

/**
 * useGeminiLive — modo VOZ en tiempo real con Noa (S322, F1 de noa-voz-live).
 *
 * Cliente del proxy `WS /api/noa/live` (koai-api → Gemini 3.8 Live). Protocolo:
 *   → binario PCM16 mono 16 kHz (frames de 40 ms del worklet `pcm-capture`)
 *   → {"type":"stop"} al colgar
 *   ← binario PCM16 mono 24 kHz → worklet `pcm-player` (cola; `interrupted` la vacía)
 *   ← JSON: ready · transcript_in/out · tool_call · tool_result · tool_result_late ·
 *           interrupted · turn_complete · reconnecting · ping · error · done
 *
 * Decisiones:
 *   - UN AudioContext (tasa nativa, 48 kHz en iOS) para captura y reproducción; el
 *     resampleo 48→16 y 24→48 lo hacen los worklets. Se crea DENTRO del gesto del
 *     botón (unlock de audio en iOS) y se `resume()` por si nació suspendido.
 *   - Foreground-only: en PWA standalone iOS el background suspende el mic y el WS.
 *     Al ocultarse la página, se cuelga limpio y se avisa; nada de reconectar solo
 *     con el mic abierto sin que el usuario lo vea.
 *   - Las transcripciones las persiste el backend en la conversación: acá sólo se
 *     muestran. Al terminar, el consumidor recarga el chat.
 */

export type LiveStatus = "idle" | "connecting" | "ready" | "reconnecting" | "ended";

export interface LiveTool {
  id: string;
  name: string;
  status: "running" | "done" | "late";
  ok?: boolean;
  summary?: string;
  ms?: number;
}

export interface LiveExchange {
  user: string;
  noa: string;
}

export interface UseGeminiLiveReturn {
  supported: boolean;
  status: LiveStatus;
  /** el usuario tiene el mic abierto y el WS vivo */
  listening: boolean;
  /** hay audio de Noa en la cola de reproducción */
  speaking: boolean;
  /** Noa está resolviendo una tool (silencio esperado) */
  thinking: boolean;
  transcriptIn: string;
  transcriptOut: string;
  exchanges: LiveExchange[];
  tools: LiveTool[];
  level: number;
  error: string | null;
  quotaSecondsLeft: number | null;
  conversationId: string | null;
  start: (conversationId?: string | null) => Promise<void>;
  stop: () => void;
}

const API_BASE = import.meta.env.VITE_API_BASE || "https://api.koai360.com";
const MAX_EXCHANGES = 4;

const CLOSE_MESSAGES: Record<number, string> = {
  4401: "Tu sesión venció. Volvé a iniciar sesión.",
  4403: "La voz no está habilitada para tu usuario.",
  4429: "Se agotó tu cuota diaria de voz.",
  4503: "El servidor de voz está lleno, probá en un momento.",
  4000: "Abriste la voz en otro dispositivo; esta sesión se cerró.",
  4502: "El servicio de voz no está disponible ahora.",
};

const LOCALIZED_MEDIA_ERRORS: Record<string, string> = {
  NotAllowedError: "Permiso de micrófono denegado. Habilitalo en Ajustes → Safari/Chrome → Micrófono.",
  NotFoundError: "No se encontró un micrófono.",
  NotReadableError: "El micrófono está en uso por otra app.",
  OverconstrainedError: "El micrófono no soporta la configuración pedida.",
  SecurityError: "El micrófono requiere HTTPS.",
};

function wsUrl(path: string): string {
  const base = API_BASE.replace(/^https:/i, "wss:").replace(/^http:/i, "ws:");
  return `${base}${path}`;
}

function toolLabel(name: string): string {
  return name.replace(/^koaihub_|^respondio_|^noa_|^gcal_|^gmail_/, "").replace(/_/g, " ");
}

export function useGeminiLive(opts: { onEnd?: (conversationId: string | null) => void } = {}): UseGeminiLiveReturn {
  const supported =
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof AudioWorkletNode !== "undefined" &&
    typeof WebSocket !== "undefined";

  const [status, setStatus] = useState<LiveStatus>("idle");
  const [speaking, setSpeaking] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [transcriptIn, setTranscriptIn] = useState("");
  const [transcriptOut, setTranscriptOut] = useState("");
  const [exchanges, setExchanges] = useState<LiveExchange[]>([]);
  const [tools, setTools] = useState<LiveTool[]>([]);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [quotaSecondsLeft, setQuota] = useState<number | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const captureRef = useRef<AudioWorkletNode | null>(null);
  const playerRef = useRef<AudioWorkletNode | null>(null);
  const inTxRef = useRef("");
  const outTxRef = useRef("");
  const micLevelRef = useRef(0);
  const noaLevelRef = useRef(0);
  const speakingRef = useRef(false);
  const endedRef = useRef(false);
  const convRef = useRef<string | null>(null);
  const onEndRef = useRef(opts.onEnd);
  useEffect(() => {
    onEndRef.current = opts.onEnd;
  });

  const cleanup = useCallback(() => {
    const ws = wsRef.current;
    wsRef.current = null;
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      try {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "stop" }));
      } catch {
        /* ya cerrado */
      }
      try {
        ws.close();
      } catch {
        /* ya cerrado */
      }
    }
    try {
      captureRef.current?.port.postMessage({ type: "mute", value: true });
      captureRef.current?.disconnect();
    } catch {
      /* nada */
    }
    try {
      playerRef.current?.port.postMessage({ type: "flush" });
      playerRef.current?.disconnect();
    } catch {
      /* nada */
    }
    captureRef.current = null;
    playerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const ctx = ctxRef.current;
    ctxRef.current = null;
    if (ctx && ctx.state !== "closed") void ctx.close().catch(() => {});
    setLevel(0);
    setSpeaking(false);
    speakingRef.current = false;
  }, []);

  const finish = useCallback(
    (reason?: string) => {
      if (endedRef.current) return;
      endedRef.current = true;
      cleanup();
      setStatus("ended");
      setThinking(false);
      onEndRef.current?.(convRef.current);
      if (reason) console.info("[GeminiLive] fin:", reason);
    },
    [cleanup],
  );

  const stop = useCallback(() => finish("usuario"), [finish]);

  // Foreground-only (iOS suspende mic + WS en background): colgar limpio al ocultarse.
  useEffect(() => {
    const onHide = () => {
      if (wsRef.current && document.visibilityState === "hidden") {
        setError("La voz se pausa en segundo plano. Tocá Llamar para seguir.");
        finish("segundo plano");
      }
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
    };
  }, [finish]);

  // Unmount: nada queda abierto
  useEffect(() => () => cleanup(), [cleanup]);

  const handleEvent = useCallback(
    (ev: Record<string, unknown>) => {
      const type = ev.type as string;
      switch (type) {
        case "ready": {
          setStatus("ready");
          if (typeof ev.quota_seconds_left === "number") setQuota(ev.quota_seconds_left);
          if (typeof ev.conversation_id === "string" && ev.conversation_id) {
            convRef.current = ev.conversation_id;
            setConversationId(ev.conversation_id);
          }
          break;
        }
        case "transcript_in":
          inTxRef.current = (inTxRef.current + " " + String(ev.text ?? "")).trim();
          setTranscriptIn(inTxRef.current);
          break;
        case "transcript_out":
          outTxRef.current += String(ev.text ?? "");
          setTranscriptOut(outTxRef.current);
          setThinking(false);
          break;
        case "tool_call": {
          const id = `${String(ev.name)}-${Date.now()}`;
          setThinking(true);
          setTools((prev) => [...prev.slice(-3), { id, name: String(ev.name), status: "running" }]);
          break;
        }
        case "tool_result":
        case "tool_result_late": {
          setTools((prev) => {
            const idx = [...prev].reverse().findIndex((t) => t.name === ev.name && t.status === "running");
            if (idx === -1) {
              return [...prev.slice(-3), {
                id: `${String(ev.name)}-${Date.now()}`, name: String(ev.name),
                status: type === "tool_result_late" ? "late" : "done",
                ok: ev.ok as boolean, summary: String(ev.summary ?? ""), ms: ev.ms as number,
              }];
            }
            const real = prev.length - 1 - idx;
            return prev.map((t, i) => (i === real ? {
              ...t, status: type === "tool_result_late" ? "late" : "done",
              ok: ev.ok as boolean, summary: String(ev.summary ?? ""), ms: ev.ms as number,
            } : t));
          });
          break;
        }
        case "interrupted":
          playerRef.current?.port.postMessage({ type: "flush" });
          outTxRef.current = "";
          setTranscriptOut("");
          break;
        case "turn_complete": {
          const u = inTxRef.current.trim();
          const n = outTxRef.current.trim();
          if (n) {
            setExchanges((prev) => [...prev, { user: u, noa: n }].slice(-MAX_EXCHANGES));
            inTxRef.current = "";
            outTxRef.current = "";
            setTranscriptIn("");
            setTranscriptOut("");
          }
          setThinking(false);
          break;
        }
        case "reconnecting":
          setStatus("reconnecting");
          break;
        case "ping":
          if (typeof ev.quota_seconds_left === "number") setQuota(ev.quota_seconds_left);
          break;
        case "error": {
          const code = String(ev.code ?? "");
          const msg = String(ev.message ?? "Error de voz");
          if (code === "resumed_lossy" || code === "audio_dropped") {
            setError(msg); // aviso, la sesión sigue
          } else {
            setError(msg);
          }
          break;
        }
        case "done":
          finish(`done:${String(ev.reason ?? "")}`);
          break;
        default:
          break;
      }
    },
    [finish],
  );

  const start = useCallback(
    async (convId?: string | null) => {
      if (!supported) {
        setError("Este navegador no soporta la voz en tiempo real.");
        return;
      }
      const token = getAuthToken();
      if (isJwtExpired(token)) {
        handleUnauthorized();
        setError("Tu sesión venció. Volvé a iniciar sesión.");
        return;
      }
      endedRef.current = false;
      setError(null);
      setStatus("connecting");
      setTools([]);
      setExchanges([]);
      setTranscriptIn("");
      setTranscriptOut("");
      inTxRef.current = "";
      outTxRef.current = "";
      convRef.current = convId ?? null;
      setConversationId(convId ?? null);

      // 1) Audio: contexto ÚNICO creado en el gesto (unlock iOS) + worklets
      let ctx: AudioContext;
      try {
        ctx = new AudioContext();
        ctxRef.current = ctx;
        if (ctx.state === "suspended") await ctx.resume();
        await ctx.audioWorklet.addModule("/worklets/pcm-capture.js");
        await ctx.audioWorklet.addModule("/worklets/pcm-player.js");
      } catch (e) {
        setError("No se pudo iniciar el audio: " + (e instanceof Error ? e.message : String(e)));
        cleanup();
        setStatus("ended");
        return;
      }

      // 2) Micrófono
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
        });
        streamRef.current = stream;
      } catch (e) {
        const name = e instanceof DOMException ? e.name : "";
        setError(LOCALIZED_MEDIA_ERRORS[name] ?? "No se pudo acceder al micrófono.");
        cleanup();
        setStatus("ended");
        return;
      }

      const player = new AudioWorkletNode(ctx, "pcm-player", { outputChannelCount: [1] });
      player.connect(ctx.destination);
      player.port.onmessage = (e: MessageEvent) => {
        const d = e.data || {};
        if (d.type === "state") {
          speakingRef.current = !!d.playing;
          setSpeaking(!!d.playing);
        } else if (d.type === "level") {
          noaLevelRef.current = d.value;
          if (speakingRef.current) setLevel(d.value);
        }
      };
      playerRef.current = player;

      const capture = new AudioWorkletNode(ctx, "pcm-capture", { numberOfOutputs: 0 });
      const src = ctx.createMediaStreamSource(stream);
      src.connect(capture);
      captureRef.current = capture;

      // 3) WebSocket
      const params = new URLSearchParams();
      params.set("token", token as string);
      if (convId) params.set("conversation_id", convId);
      const ws = new WebSocket(wsUrl(`/api/noa/live?${params.toString()}`));
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      capture.port.onmessage = (e: MessageEvent) => {
        const d = e.data || {};
        if (d.type === "audio") {
          if (ws.readyState === WebSocket.OPEN) ws.send(d.buffer as ArrayBuffer);
        } else if (d.type === "level") {
          micLevelRef.current = d.value;
          if (!speakingRef.current) setLevel(d.value);
        }
      };

      ws.onmessage = (e: MessageEvent) => {
        if (e.data instanceof ArrayBuffer) {
          playerRef.current?.port.postMessage({ type: "audio", buffer: e.data }, [e.data]);
          return;
        }
        try {
          handleEvent(JSON.parse(String(e.data)));
        } catch {
          /* mensaje no JSON: ignorar */
        }
      };
      ws.onerror = () => {
        if (!endedRef.current) setError("No se pudo conectar con el servicio de voz.");
      };
      ws.onclose = (e: CloseEvent) => {
        if (endedRef.current) return;
        const known = CLOSE_MESSAGES[e.code];
        if (known) setError(known);
        else if (e.code !== 1000 && e.code !== 1005) setError(`La voz se cortó (${e.code}${e.reason ? ": " + e.reason : ""}).`);
        if (e.code === 4401) handleUnauthorized();
        finish(`close:${e.code}`);
      };
    },
    [supported, cleanup, finish, handleEvent],
  );

  return {
    supported,
    status,
    listening: status === "ready" || status === "reconnecting",
    speaking,
    thinking,
    transcriptIn,
    transcriptOut,
    exchanges,
    tools,
    level,
    error,
    quotaSecondsLeft,
    conversationId,
    start,
    stop,
  };
}

export { toolLabel };
