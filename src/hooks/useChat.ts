import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  createConversation,
  deleteConversation as apiDeleteConversation,
  getMessages,
  listConversations,
  streamMessage,
  type StreamEvent,
} from "@/lib/api";
import type { ChatMessage, Conversation, SendMessagePayload, ThinkingLevel } from "@/types/api";
import { resolveThinkingLevel, type ModelMode } from "@/lib/autoThinking";

/**
 * useChat — state machine principal del chat con Noa.
 *
 * Maneja:
 *   - Carga inicial de conversaciones
 *   - Selección de conversación activa + load mensajes
 *   - Envío de mensajes con streaming SSE
 *   - Optimistic update del mensaje user + streaming del assistant
 *   - Stop generation con AbortController
 *   - Hint mientras Noa "piensa" (consultando, escribiendo, etc.)
 */
export interface UseChatReturn {
  conversations: Conversation[];
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  messages: ChatMessage[];
  loading: boolean;
  loadingHint: string | null;
  /** S158-b: getMessages falló — la UI muestra banner con Reintentar */
  loadError: boolean;
  retryLoad: () => void;
  streamingText: string;
  modelMode: ModelMode;
  setModelMode: (mode: ModelMode) => void;
  /** Retorna false si el envío NO fue aceptado (ej. falló crear la conversación) */
  sendMessage: (text: string, opts?: Partial<SendMessagePayload>) => Promise<boolean>;
  /** S163: mensajes encolados mientras Noa responde — se auto-envían al terminar */
  queuedCount: number;
  stopGeneration: () => void;
  newConversation: () => Promise<Conversation>;
  deleteConversation: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export interface UseChatOptions {
  userId: string | undefined;
  /**
   * Invocado cuando sendMessage crea una conversación nueva (porque no había
   * activa). El consumer típicamente hace `navigate({ kind: "chat", conversationId })`
   * para sincronizar el URL hash. Se llama DESPUÉS de setActive + setMessages
   * optimistas + skipNextLoadRef, así el useEffect del activeId skipea el load.
   */
  onConversationCreated?: (id: string) => void;
}

const MODEL_MODE_KEY = "noa.modelMode";

function loadInitialMode(): ModelMode {
  try {
    const saved = localStorage.getItem(MODEL_MODE_KEY);
    if (saved === "standard" || saved === "pro") return saved;
    // Migración: usuarios viejos con "auto" guardado → standard
  } catch {
    /* noop */
  }
  return "standard";
}

export function useChat(options: UseChatOptions): UseChatReturn {
  const { userId, onConversationCreated } = options;
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveIdState] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingHint, setLoadingHint] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState("");
  const [modelMode, setModelModeState] = useState<ModelMode>(loadInitialMode);

  const setModelMode = useCallback((mode: ModelMode) => {
    setModelModeState(mode);
    try {
      localStorage.setItem(MODEL_MODE_KEY, mode);
    } catch {
      /* noop */
    }
  }, []);

  const abortRef = useRef<AbortController | null>(null);
  const activeIdRef = useRef<string | null>(null);
  // S158 (review Codex): secuencia de envíos — invalida refetchs diferidos de
  // turnos viejos cuando arranca un send nuevo (race del setTimeout 2.5s).
  const sendSeqRef = useRef(0);
  // S158-b (review Codex): guard SINCRÓNICO anti doble-envío — `loading` es
  // estado React y dos taps en el mismo frame entran ambos con loading=false.
  const sendInFlightRef = useRef(false);
  // Cuando sendMessage crea una conv nueva, NO queremos que el useEffect del
  // activeId resetee los messages — el optimistic user msg ya está seteado y
  // getMessages() devolvería [] (conv nueva sin nada en backend). Marcamos
  // el id aquí para que el effect lo skipee una sola vez.
  const skipNextLoadRef = useRef<string | null>(null);
  // S163: cola de mensajes tipeados MIENTRAS Noa responde. Antes el guard de
  // loading los rechazaba (input bloqueado hasta fin del stream). Ahora se
  // encolan y el finally del turno en curso los despacha en orden. El stream
  // del backend es 1 turno por request — encolar client-side evita dos
  // streams paralelos pisándose la persistencia de la misma conversación.
  const queueRef = useRef<Array<{ text: string; opts: Partial<SendMessagePayload> }>>([]);
  const [queuedCount, setQueuedCount] = useState(0);
  const sendMessageRef = useRef<
    ((text: string, opts?: Partial<SendMessagePayload>) => Promise<boolean>) | null
  >(null);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  // Setter sync que actualiza el ref ANTES del setState. Eliminar la race
  // condition donde sendMessage leía `activeIdRef.current` stale (aún null)
  // entre un `setActiveIdState(newConv)` y el siguiente render → creaba una
  // segunda conv duplicada (bug 2026-05-23: 2 convs en 300ms, mensaje "Que me
  // propones?" cayó en conv distinta a la del precio stickers).
  const setActive = useCallback((id: string | null) => {
    activeIdRef.current = id;
    setActiveIdState(id);
  }, []);

  // Carga inicial de conversaciones
  useEffect(() => {
    if (!userId) return;
    listConversations()
      .then(setConversations)
      .catch((err) => console.warn("[useChat] listConversations failed", err));
  }, [userId]);

  // Cuando cambia activeId, cargar mensajes.
  // S136: NO hacer setMessages([]) eager — espera la respuesta del backend.
  // Eager-clear borraba el optimistic user msg en algunos race conditions
  // (sendMessage seteaba [userMsg] + setActiveId, y este effect arrasaba antes
  // de que el flag skipNext se aplicara). El usuario veía "Pensando…" sin su msg.
  useEffect(() => {
    // S158 (review Codex): streamingText es estado global del hook — al cambiar
    // de conversación limpiarlo para que el stream de la conv anterior no quede
    // pintado en la nueva. Si se vuelve a la conv en stream, el próximo onDelta
    // (con guard isCurrent) lo repinta.
    setStreamingText("");
    if (!activeId) {
      setMessages([]);
      return;
    }
    if (skipNextLoadRef.current === activeId) {
      skipNextLoadRef.current = null;
      return; // sendMessage ya seteó messages con el optimistic user msg
    }
    setLoadError(false);
    // review Codex S158-b: al cambiar a OTRA conversación, no dejar visibles
    // los mensajes de la anterior mientras carga (y un loadError encima de
    // mensajes ajenos era confuso). Solo limpia si lo visible es de otra conv.
    setMessages((prev) =>
      prev.length > 0 && prev[0]?.conversation_id !== activeId ? [] : prev,
    );
    getMessages(activeId)
      .then((msgs) => {
        if (activeIdRef.current !== activeId) return;
        // Si el backend devuelve [] y hay msgs locales (optimistic), mantenerlos.
        // Sino el optimistic user msg se borra mid-stream.
        setMessages((prev) => (msgs.length === 0 && prev.length > 0 ? prev : msgs));
      })
      .catch((err) => {
        console.warn("[useChat] getMessages failed", err);
        // S158-b: antes fallaba en silencio → conversación "en blanco" sin
        // explicación. Ahora la UI muestra banner con Reintentar.
        if (activeIdRef.current === activeId) setLoadError(true);
      });
  }, [activeId]);

  // S158-b: re-disparo manual del load tras un error (banner "Reintentar")
  const retryLoad = useCallback(() => {
    const id = activeIdRef.current;
    if (!id) return;
    setLoadError(false);
    getMessages(id)
      .then((msgs) => {
        if (activeIdRef.current !== id) return;
        setMessages((prev) => (msgs.length === 0 && prev.length > 0 ? prev : msgs));
      })
      .catch(() => {
        if (activeIdRef.current === id) setLoadError(true);
      });
  }, []);

  const setActiveId = useCallback((id: string | null) => {
    setActive(id);
  }, [setActive]);

  // S158 — iOS suspende la PWA en background y mata el fetch del stream sin
  // aviso (el fallo #1 en iPhone: mandás mensaje, bloqueás pantalla, la
  // respuesta "se pierde"). El backend ahora persiste la respuesta aunque el
  // cliente se desconecte → al volver a foreground reconciliamos con refetch
  // (resume-lite). Solo si NO hay stream vivo, para no pisar un turno activo.
  useEffect(() => {
    // S164-b: el reconcile de una sola pasada no alcanzaba — si el backend
    // SIGUE generando cuando el user vuelve (imagen tarda 30-90s; el runner
    // desacoplado corre hasta 600s), el refetch único no encontraba nada y el
    // turno se veía "muerto" ("se apaga la pantalla y se detiene el proceso").
    // Ahora: si el último mensaje del server es del user (turno incompleto),
    // re-chequear cada 6s hasta ~2 min hasta que llegue la respuesta.
    let retryTimer: number | null = null;
    const cancelRetry = () => {
      if (retryTimer !== null) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
    };
    const attempt = (retriesLeft: number) => {
      if (document.visibilityState !== "visible") return;
      const id = activeIdRef.current;
      if (!id) return;
      if (abortRef.current) return; // stream activo — no tocar
      const seqAtFetch = sendSeqRef.current;
      getMessages(id)
        .then((msgs) => {
          if (activeIdRef.current !== id) return;
          if (abortRef.current || sendSeqRef.current !== seqAtFetch) return; // send nuevo arrancó
          // Merge conservador (review Codex): solo reemplazar si el server
          // tiene al menos tantos mensajes como los locales — no pisar
          // optimistas de un turno que el backend aún no terminó de persistir.
          if (msgs.length > 0) {
            setMessages((prev) => (msgs.length >= prev.length ? msgs : prev));
          }
          const last = msgs[msgs.length - 1];
          const turnIncomplete = !!last && last.role === "user";
          if (turnIncomplete && retriesLeft > 0) {
            retryTimer = window.setTimeout(() => attempt(retriesLeft - 1), 6000);
          }
        })
        .catch(() => {});
    };
    const reconcile = () => {
      cancelRetry();
      attempt(20); // 20 × 6s ≈ 2 min de cobertura (imagen + tools largos)
    };
    document.addEventListener("visibilitychange", reconcile);
    window.addEventListener("pageshow", reconcile);
    return () => {
      cancelRetry();
      document.removeEventListener("visibilitychange", reconcile);
      window.removeEventListener("pageshow", reconcile);
    };
  }, []);

  const newConversation = useCallback(async (): Promise<Conversation> => {
    const conv = await createConversation("noa");
    setConversations((prev) => [conv, ...prev]);
    setActive(conv.id);
    return conv;
  }, [setActive]);

  const deleteConversation = useCallback(
    async (id: string) => {
      // S158-b: rollback — antes el catch tragaba el error y borraba local
      // igual, y la conversación "resucitaba" en el próximo refresh.
      try {
        await apiDeleteConversation(id);
      } catch (err) {
        console.warn("[useChat] delete failed", err);
        toast.error("No se pudo borrar la conversación. Intentá de nuevo.");
        throw err;
      }
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeIdRef.current === id) {
        setActive(null);
        setMessages([]);
      }
    },
    [setActive],
  );

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
    setLoadingHint(null);
  }, []);

  const sendMessage = useCallback(
    async (text: string, opts: Partial<SendMessagePayload> = {}) => {
      // S139 fix: permitir send con texto vacío SI hay attachment (image o file).
      // Antes `if (!text.trim()) return` abortaba silencioso la 2ª+ imagen/archivo
      // que el AppShell mandaba como mensajes separados sin texto.
      const hasAttachment = Boolean(
        opts.image_base64 || opts.file_base64 || opts.image_url,
      );
      if (!text.trim() && !hasAttachment) return false;
      // S163: Noa todavía está respondiendo → encolar en vez de rechazar.
      // El finally del turno en curso lo despacha apenas termine el stream.
      if (loading || sendInFlightRef.current) {
        queueRef.current.push({ text, opts });
        setQueuedCount(queueRef.current.length);
        return true; // aceptado — el input se limpia, el mensaje NO se pierde
      }
      sendInFlightRef.current = true;

      // S158 — cerrar la ventana de doble-envío: setLoading(true) ANTES del
      // await de createConversation. Antes, durante ese await (~300ms) loading
      // seguía false → un segundo tap re-entraba y creaba conv/mensaje duplicado.
      setLoading(true);
      sendSeqRef.current += 1; // invalida refetchs diferidos de turnos previos

      // Garantizar conversación activa. Si no hay activa, creamos una pero
      // NO disparamos el load del useEffect — vamos a setear messages a mano
      // con el optimistic user msg + flag para skipear la próxima carga.
      const existingId = activeIdRef.current;
      const isNewConv = !existingId;
      let convId: string;
      if (existingId) {
        convId = existingId;
      } else {
        try {
          const conv = await createConversation("noa");
          setConversations((prev) => [conv, ...prev]);
          convId = conv.id;
        } catch (err) {
          // S158-b: antes el mensaje tipeado se perdía en silencio total.
          // Toast visible + return false → ChatInput restaura el texto.
          console.error("[useChat] createConversation failed", err);
          toast.error("No se pudo enviar — sin conexión con Noa. Intentá de nuevo.");
          setLoading(false);
          sendInFlightRef.current = false;
          return false;
        }
      }

      // Optimistic user message — S139 fix: incluir image_base64 como data URL
      // para que la imagen aparezca visualmente apenas el user envía, antes
      // de que llegue la respuesta del backend. Multi-attachment: la 1ª imagen
      // se muestra en este msg + setMessages append N-1 rows extra (1 por
      // imagen adicional) + 1 row por file con placeholder 📎. Eso matchea
      // el patrón de persistencia del backend (1 row text + N rows imagen).
      const asDataUrl = (b64: string) =>
        b64.startsWith("data:") ? b64 : `data:image/png;base64,${b64}`;
      const optimisticImage: string | undefined = opts.image_base64
        ? asDataUrl(opts.image_base64)
        : opts.image_url || undefined;
      const optimisticContent: string = text || (
        opts.file_name
          ? `📎 ${opts.file_name}`
          : (opts.image_base64 || opts.image_url ? "" : "")
      );
      const userMsg: ChatMessage = {
        id: `tmp-${Date.now()}`,
        conversation_id: convId,
        role: "user",
        content: optimisticContent,
        image: optimisticImage,
        created_at: new Date().toISOString(),
      };
      // Rows extra optimistic: 1 por imagen adicional + 1 por file adicional
      const extraOptimisticMsgs: ChatMessage[] = [];
      const baseTs = Date.now();
      (opts.images || []).forEach((b64: string, i: number) => {
        if (!b64) return;
        extraOptimisticMsgs.push({
          id: `tmp-${baseTs}-img-${i}`,
          conversation_id: convId,
          role: "user",
          content: "",
          image: asDataUrl(b64),
          created_at: new Date(baseTs + i + 1).toISOString(),
        });
      });
      (opts.files || []).forEach((f, i: number) => {
        if (!f?.base64) return;
        extraOptimisticMsgs.push({
          id: `tmp-${baseTs}-file-${i}`,
          conversation_id: convId,
          role: "user",
          content: `📎 ${f.name || "archivo"}`,
          created_at: new Date(baseTs + 1000 + i).toISOString(),
        });
      });

      if (isNewConv) {
        // Conv recién creada: marcar para skipear el load, setear messages, activar conv,
        // y notificar al consumer (AppShell) para que sincronice el URL.
        // El orden importa: skipNextLoadRef ANTES de setActive evita que el
        // useEffect del [activeId] dispare getMessages([]) y pise el userMsg
        // optimista (bug P1-1 audit S139).
        skipNextLoadRef.current = convId;
        setMessages([userMsg, ...extraOptimisticMsgs]);
        setActive(convId);
        onConversationCreated?.(convId);
      } else {
        setMessages((prev) => [...prev, userMsg, ...extraOptimisticMsgs]);
      }
      setStreamingText("");
      setLoadingHint("Pensando…");

      const abort = new AbortController();
      abortRef.current = abort;

      // Resolver thinking_level según el mode (sin auto):
      //   - standard → medium (Gemini 3.5 Pro thinking=medium)
      //   - pro      → high   (Gemini 3.5 Pro thinking=high)
      const resolvedLevel: ThinkingLevel = resolveThinkingLevel(modelMode);

      const payload: SendMessagePayload = {
        message: text,
        conversation_id: convId,
        agent: "noa",
        thinking_level: resolvedLevel,
        ...opts,
      };

      let accumulated = "";
      let imageUrl: string | null = null;
      let sawDone = false;
      let sawError = false;
      let streamClosed = false;
      let flushPending = false;
      // S158 — guard de conversación: si el usuario cambia de conversación
      // mid-stream, los setState de este turno NO deben sangrar a la conv
      // nueva (bug: respuesta aparecía en la conversación equivocada). El
      // texto igual se persiste backend-side; al volver, getMessages lo trae.
      const isCurrent = () => activeIdRef.current === convId;
      // S158-b: throttle de render del stream a ~12fps — antes CADA delta SSE
      // re-parseaba TODO el markdown acumulado (O(n²) en respuestas largas).
      // Mismo look visual, fracción del costo.
      const flushStream = () => {
        flushPending = false;
        if (streamClosed || !isCurrent()) return;
        setStreamingText(accumulated);
      };
      try {
        for await (const ev of streamMessage(payload, abort.signal)) {
          handleStreamEvent(ev, {
            onDelta: (delta) => {
              accumulated += delta;
              if (!isCurrent()) return;
              if (!flushPending) {
                flushPending = true;
                setTimeout(flushStream, 80);
              }
              setLoadingHint(null);
            },
            onHint: (hint) => {
              if (isCurrent()) setLoadingHint(hint);
            },
            onImage: (url) => {
              imageUrl = url;
              if (isCurrent()) setLoadingHint(null);
              // Notificar a la galería que hay imagen nueva → recarga primera página
              // (S136: sin esto, la imagen recién generada no aparece hasta que el user
              // navega manualmente a Galería y la página se re-monta).
              if (url) {
                window.dispatchEvent(
                  new CustomEvent("noa:image-generated", { detail: { url } }),
                );
              }
            },
            onDone: () => {
              sawDone = true;
              // S164-b: cerrar el stream ANTES de promover — el timer del
              // throttle (+80ms) podía disparar flushStream DESPUÉS de done
              // y re-pintar streamingText completo debajo del mensaje ya
              // promovido → "efecto de carga doble" que reportó Jesús.
              streamClosed = true;
              // Promovemos streamingText → message
              if ((accumulated || imageUrl) && convId && isCurrent()) {
                const assistantMsg: ChatMessage = {
                  id: `assistant-${Date.now()}`,
                  conversation_id: convId,
                  role: "assistant",
                  content: accumulated,
                  image: imageUrl,
                  created_at: new Date().toISOString(),
                };
                setMessages((prev) => [...prev, assistantMsg]);
              }
              if (isCurrent()) setStreamingText("");
            },
            // S158 — antes `event: error` se descartaba en silencio (solo
            // console.warn) → burbuja vacía/colgada. Ahora renderiza un
            // mensaje visible si el turno no produjo texto.
            onError: () => {
              sawError = true;
              if (!accumulated && !imageUrl && isCurrent()) {
                const errMsg: ChatMessage = {
                  id: `err-${Date.now()}`,
                  conversation_id: convId,
                  role: "assistant",
                  content: `_Error al generar respuesta. Intentá de nuevo._`,
                  created_at: new Date().toISOString(),
                };
                setMessages((prev) => [...prev, errMsg]);
              }
              if (isCurrent()) setLoadingHint(null);
            },
          });
        }
      } catch (err) {
        if ((err as { name?: string })?.name === "AbortError") {
          sawError = true; // stop deliberado del usuario — sin burbuja extra
        } else {
          console.error("[useChat] stream error", err);
          sawError = true;
          if (isCurrent()) {
            const errMsg: ChatMessage = {
              id: `err-${Date.now()}`,
              conversation_id: convId,
              role: "assistant",
              content: `_Error al generar respuesta. Intentá de nuevo._`,
              created_at: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, errMsg]);
          }
          // S158 — el backend puede haber completado y persistido el turno
          // aunque la conexión murió (iOS/red). Reconciliar en ~2.5s: si el
          // server ya tiene la respuesta real, reemplaza la burbuja de error.
          const refetchId = convId;
          const seqAtError = sendSeqRef.current;
          setTimeout(() => {
            if (activeIdRef.current !== refetchId || abortRef.current) return;
            if (sendSeqRef.current !== seqAtError) return; // send nuevo arrancó
            getMessages(refetchId)
              .then((msgs) => {
                if (activeIdRef.current !== refetchId) return;
                if (abortRef.current || sendSeqRef.current !== seqAtError) return;
                if (msgs.length > 0) {
                  setMessages((prev) => (msgs.length >= prev.length ? msgs : prev));
                }
              })
              .catch(() => {});
          }, 2500);
        }
      } finally {
        streamClosed = true; // S158-b: invalida flushes diferidos del throttle
        // Si el stream terminó sin enviar `done` (timeout, abort, error), flush manual
        if ((accumulated || imageUrl) && !sawDone && isCurrent()) {
          setMessages((prev) => {
            // Dedup: si onDone ya promovió, no agregar de nuevo
            if (prev.some((m) => m.role === "assistant" && m.content === accumulated && m.image === imageUrl)) {
              return prev;
            }
            return [
              ...prev,
              {
                id: `assistant-${Date.now()}`,
                conversation_id: convId!,
                role: "assistant",
                content: accumulated,
                image: imageUrl,
                created_at: new Date().toISOString(),
              },
            ];
          });
        }
        // S158 — stream cerró sin texto, sin done y sin error renderizado →
        // antes quedaba la nada absoluta ("Pensando…" desaparecía y ya).
        if (!accumulated && !imageUrl && !sawDone && !sawError && isCurrent()) {
          const silent: ChatMessage = {
            id: `err-${Date.now()}`,
            conversation_id: convId,
            role: "assistant",
            content: `_No llegó respuesta. Reintentá en un momento._`,
            created_at: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, silent]);
        }
        if (isCurrent()) setStreamingText("");
        setLoading(false);
        setLoadingHint(null);
        abortRef.current = null;
        sendInFlightRef.current = false;

        // S163: despachar el siguiente mensaje encolado (tipeado mid-stream).
        // setTimeout deja que el setLoading(false) re-renderice antes — el
        // sendMessage fresco (via ref) ya ve loading=false y entra directo.
        const next = queueRef.current.shift();
        setQueuedCount(queueRef.current.length);
        if (next) {
          setTimeout(() => {
            void sendMessageRef.current?.(next.text, next.opts);
          }, 120);
        }

        // Auto-title: el backend genera título en ~5-8s tras el primer turno.
        // Refrescamos la lista a los 7s para que el sidebar tome el nuevo título.
        // Solo si la conversación actual todavía tiene el title default.
        const currentConv = conversations.find((c) => c.id === convId);
        const stillDefault =
          !currentConv?.title ||
          ["nueva conversación", "nueva conversacion", "new conversation"].includes(
            currentConv.title.trim().toLowerCase(),
          );
        if (stillDefault) {
          setTimeout(() => {
            listConversations()
              .then(setConversations)
              .catch(() => {});
          }, 7000);
        }
      }
      return true; // envío aceptado — ChatInput puede descartar el texto
    },
    // P3-7 audit: messages y newConversation no se usan en el body — sacarlos
    // evita re-create de sendMessage en cada streaming delta.
    [loading, modelMode, conversations, onConversationCreated, setActive],
  );

  // S163: ref siempre apuntando al sendMessage fresco — el dispatcher de la
  // cola (finally del turno previo) lo invoca fuera del closure viejo.
  useEffect(() => {
    sendMessageRef.current = sendMessage;
  }, [sendMessage]);

  const refresh = useCallback(async () => {
    try {
      const list = await listConversations();
      setConversations(list);
    } catch (err) {
      console.warn("[useChat] refresh failed", err);
    }
  }, []);

  return {
    conversations,
    activeId,
    setActiveId,
    messages,
    loading,
    loadingHint,
    loadError,
    retryLoad,
    streamingText,
    modelMode,
    setModelMode,
    sendMessage,
    queuedCount,
    stopGeneration,
    newConversation,
    deleteConversation,
    refresh,
  };
}

function handleStreamEvent(
  ev: StreamEvent,
  handlers: {
    onDelta: (text: string) => void;
    onHint: (hint: string) => void;
    onDone: () => void;
    onImage: (url: string) => void;
    onError?: (message: string) => void;
  },
) {
  const data = ev.data;
  const type = ev.type as string;

  // koai-api emite `event: token` para texto del LLM, `event: image` para imágenes,
  // `event: image_metadata` para metadata, `event: ping` para heartbeat, `event: done`.
  // También aceptamos `delta` (alias generic), `hint` (status), `card` (estructurada).
  switch (type) {
    case "token":
    case "delta": {
      const text =
        typeof data === "string"
          ? data
          : (data as { text?: string; content?: string; delta?: string })?.text ??
            (data as { text?: string; content?: string; delta?: string })?.content ??
            (data as { text?: string; content?: string; delta?: string })?.delta ??
            "";
      if (text) handlers.onDelta(text);
      break;
    }
    case "image": {
      const url =
        typeof data === "string"
          ? data
          : (data as { image?: string; url?: string })?.image ??
            (data as { image?: string; url?: string })?.url ??
            "";
      if (url) handlers.onImage(url);
      break;
    }
    case "image_metadata":
      // Solo log/track — no se renderiza en chat por ahora
      break;
    case "ping":
      // Heartbeat keepalive — ignorar
      break;
    case "hint": {
      const hint =
        typeof data === "string"
          ? data
          : (data as { text?: string; hint?: string })?.text ??
            (data as { text?: string; hint?: string })?.hint ??
            "";
      if (hint) handlers.onHint(hint);
      break;
    }
    case "done":
      handlers.onDone();
      break;
    case "tool_call":
    case "tool_result":
      if (data && typeof data === "object" && "name" in data) {
        const name = String((data as { name: unknown }).name);
        handlers.onHint(`Consultando ${name}…`);
      }
      break;
    case "card":
      if (data && typeof data === "object") {
        const typed = data as { type?: string };
        if (typed.type) {
          const block = `\n\`\`\`card:${typed.type}\n${JSON.stringify(data)}\n\`\`\`\n`;
          handlers.onDelta(block);
        }
      }
      break;
    case "error": {
      // S158 — antes solo console.warn → el usuario veía una burbuja vacía.
      console.warn("[useChat] backend error event", data);
      const msg =
        typeof data === "string"
          ? data
          : (data as { error?: string; message?: string })?.error ??
            (data as { error?: string; message?: string })?.message ??
            "";
      handlers.onError?.(msg);
      break;
    }
    default:
      // Log no-mapeado para diagnosis sin romper el stream
      if (type !== "message") {
        console.debug("[useChat] unmapped event type:", type, data);
      }
      break;
  }
}
