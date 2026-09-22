/**
 * API client — wrapper REST + SSE para koai-api en api.koai360.com.
 *
 * Auth: la sesión vive en localStorage como `noa.session` (JWT + user info).
 * Headers: `Authorization: Bearer <jwt>` + `X-API-Key` para endpoints internos
 * que necesiten ambas validaciones.
 *
 * Errores: throw `ApiError` con status + message normalizados.
 */

import type {
  ChatImage,
  ChatMessage,
  Conversation,
  SendMessagePayload,
  UserMemory,
} from "@/types/api";

const API_BASE = import.meta.env.VITE_API_BASE || "https://api.koai360.com";
const API_KEY = import.meta.env.VITE_API_KEY || "koai-dev-2026";

export class ApiError extends Error {
  status: number;
  data?: unknown;

  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.status = status;
    this.data = data;
    this.name = "ApiError";
  }
}

interface FetchOpts extends RequestInit {
  json?: unknown;
  skipAuth?: boolean;
  /** S158-b: NO disparar el logout global ante 401 — para endpoints donde el
   *  401 significa otra cosa (ej. verify-pin: "PIN incorrecto", no sesión
   *  inválida). Antes un PIN mal tipeado deslogueaba al usuario de toda la app. */
  skip401Handler?: boolean;
}

async function apiFetch(path: string, opts: FetchOpts = {}): Promise<Response> {
  const { json, skipAuth, skip401Handler, headers, ...rest } = opts;

  const finalHeaders: Record<string, string> = {
    ...(headers as Record<string, string>),
  };

  // Backend prefiere JWT sobre API key — si hay JWT, mandar SOLO ese
  // (sino el middleware setea user_id="api-key-user" e ignora el JWT)
  const token = skipAuth ? null : getAuthToken();
  if (token) {
    finalHeaders["Authorization"] = `Bearer ${token}`;
  } else {
    finalHeaders["X-API-Key"] = API_KEY;
  }

  if (json !== undefined) {
    finalHeaders["Content-Type"] = "application/json";
  }

  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...rest,
    headers: finalHeaders,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });

  if (!res.ok) {
    let data: unknown;
    try {
      data = await res.json();
    } catch {
      data = await res.text().catch(() => undefined);
    }
    let message = `HTTP ${res.status}`;
    if (data && typeof data === "object" && "detail" in data) {
      const detail = (data as { detail: unknown }).detail;
      if (detail) message = String(detail);
    }
    // Token expirado/inválido: forzar re-login en vez de fallar en silencio.
    if (res.status === 401 && !skipAuth && !skip401Handler) handleUnauthorized();
    throw new ApiError(res.status, message, data);
  }

  return res;
}

// ============================================================
// AUTH
// ============================================================

const TOKEN_KEY = "noa.token";

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

/**
 * Chequea client-side si un JWT está expirado (o es ilegible) decodificando
 * el claim `exp`. Margen de 30s para evitar carreras con el reloj del server.
 * No valida la firma — eso lo hace el backend; aquí solo evitamos arrancar la
 * app con un token muerto que haría fallar TODO con 401 en silencio.
 */
export function isJwtExpired(token: string | null): boolean {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    if (!payload?.exp) return false; // sin exp → dejamos que el backend decida
    return Date.now() >= payload.exp * 1000 - 30_000;
  } catch {
    return true; // token corrupto → tratar como expirado
  }
}

/**
 * Sesión inválida (401 del backend o token expirado): limpia credenciales y
 * dispara un evento global para que useAuth muestre la pantalla de login.
 * Sin esto, un token vencido deja la app "logueada" pero muerta (sin historial,
 * sin poder enviar) — exactamente el síntoma reportado.
 */
export function handleUnauthorized(): void {
  setAuthToken(null);
  localStorage.removeItem("noa.user");
  window.dispatchEvent(new CustomEvent("noa:unauthorized"));
}

// ============================================================
// FEATURE FLAGS (server-side, por usuario — S322)
// ============================================================

/** `GET /api/noa/flags` → { key: bool } evaluado para el usuario del JWT. */
export async function getNoaFlags(): Promise<{ flags: Record<string, boolean>; ttl: number }> {
  const res = await apiFetch("/api/noa/flags");
  return res.json();
}

// ============================================================
// CONVERSATIONS
// ============================================================

export async function listConversations(): Promise<Conversation[]> {
  const res = await apiFetch("/api/chat/conversations");
  const data = await res.json();
  return Array.isArray(data) ? data : data.items || data.conversations || [];
}

export async function createConversation(agent = "noa", title?: string): Promise<Conversation> {
  const res = await apiFetch("/api/chat/conversations", {
    method: "POST",
    json: { agent, title },
  });
  return res.json();
}

export async function deleteConversation(id: string): Promise<void> {
  await apiFetch(`/api/chat/conversations/${id}`, { method: "DELETE" });
}

export async function getMessages(conversationId: string): Promise<ChatMessage[]> {
  const res = await apiFetch(`/api/chat/conversations/${conversationId}/messages`);
  const data = await res.json();
  return Array.isArray(data) ? data : data.items || data.messages || [];
}

export async function deleteMessages(conversationId: string, messageIds: string[]): Promise<void> {
  await apiFetch(`/api/chat/conversations/${conversationId}/messages`, {
    method: "DELETE",
    json: { message_ids: messageIds },
  });
}

export async function renameConversation(id: string, title: string): Promise<void> {
  await apiFetch(`/api/chat/conversations/${id}`, {
    method: "PATCH",
    json: { title },
  });
}

// ============================================================
// BANDEJA — dudas que Kira escaló al equipo
// ============================================================

export interface InboxQuestion {
  id: string;
  contact_name: string;
  contact_phone?: string | null;
  question: string;
  context?: string | null;
  channel_id?: number | null;
  created_at?: string;
  waiting?: string;
  /** S288: la duda es de estado de pedido y el cliente NO tiene pedido en KoaiHub. */
  missing_order?: boolean | null;
  /** S264: "duda" (kira_escalations) o "precio" (kira_pricing_knowledge). */
  kind?: "duda" | "precio";
  /** S304: etapa comercial del contacto, resuelta en el server contra KoaiHub.
   *  quote = tiene cotización abierta (comprador) · pedido = tiene pedido (activo o entregado)
   *  · nuevo / sin_ficha = sin quote ni pedido · null = KoaiHub no respondió (no se afirma). */
  stage?: "quote" | "pedido" | "nuevo" | "sin_ficha" | null;
  /** Texto corto del chip: "Quote QT1162 · $2,033 · enviada", "Pedido SO-1085 · en produccion". */
  stage_label?: string | null;
  stage_ref?: string | null;
  stage_group?: string | null;
  /** S332: ya hay hilo interno con Kira sobre esta duda (repreguntas / borradores). */
  thread_count?: number;
  in_discussion?: boolean;
  /** Lo último que Kira le dijo al equipo en el hilo (corto), para la lista. */
  last_kira?: string | null;
  last_type?: ThreadMessageType | null;
}

/** S332: un turno del hilo interno equipo ↔ Kira (tabla escalation_messages). */
export type ThreadMessageType = "internal_query" | "internal_reply" | "client_preview" | "system_action";
export interface ThreadMessage {
  id: string;
  sender: "kira" | "user";
  author?: string | null;
  content: string;
  message_type: ThreadMessageType;
  meta?: Record<string, unknown> | null;
  created_at?: string | null;
}
export interface ThreadResult {
  escalation_id: string;
  kind: "duda" | "precio";
  status?: string | null;
  contact_name: string;
  messages: ThreadMessage[];
}

export interface ComposeResult {
  status: "draft";
  escalation_id: string;
  contact_name: string;
  draft: string;
  confident: boolean;
  reason?: string;
  /** S332: lo que Kira le dice al EQUIPO tras componer («¿lo envío?» o su repregunta). */
  kira_says?: string;
  thread_message?: ThreadMessage | null;
  thread_len?: number;
}

/** S304: lección que Kira destiló de la respuesta enviada. Nace `pending`; el equipo la
 *  aprueba o rechaza con un toque (misma API que la sección Lecciones). */
export interface LearningProposal {
  id: number;
  lesson: string;
  kind: string;
  confidence?: number;
}

export interface SendResult {
  status: "sent" | "taken" | "standby" | "error";
  message?: string;
  contact_name?: string;
  learning_proposal?: LearningProposal | null;
}

// ============================================================
// PANEL DE CONTEXTO (escritorio ≥1536, S332 F3) — lo que hay que mirar HOY, por rol
// ============================================================

export interface PanelOrderRef { nro: string; entrega?: string | null; estado?: string | null }
export interface PanelOperations {
  ventana_dias: number;
  vencidos: PanelOrderRef[];
  proximos: PanelOrderRef[];
  bloqueados: PanelOrderRef[];
  en_hold: PanelOrderRef[];
  activos: number;
}
export interface PanelFinance {
  mora_dias: number;
  mora_count: number;
  mora_total: number;
  merchants_sin_categorizar: number | null;
}
export interface PanelBandeja {
  count: number | null;
  quote: number;
  pedido: number;
  nuevo: number;
  top: Array<{ id: string; contact_name: string; question: string; waiting: string }>;
}
export interface PanelData {
  user: string;
  view: { operations: boolean; finance: boolean };
  updated_at: string;
  business_date: string;
  operations: PanelOperations | null;
  finance: PanelFinance | null;
  bandeja: PanelBandeja;
  partial_errors: string[];
}

/** `GET /api/noa/panel` — sólo equipo; los bloques operations/finance vienen null si el rol no los ve. */
export async function getPanel(force = false): Promise<PanelData> {
  const res = await apiFetch(`/api/noa/panel${force ? "?force=1" : ""}`);
  return res.json();
}

/** Lista las dudas pendientes (más viejas primero). */
export async function listInbox(): Promise<InboxQuestion[]> {
  const res = await apiFetch("/api/escalations/pending");
  const data = await res.json();
  return Array.isArray(data.items) ? data.items : [];
}

/** S332: hilo interno de una duda (apertura de Kira + turnos). Precio → messages vacío. */
export async function getEscalationThread(id: string): Promise<ThreadResult> {
  const res = await apiFetch(`/api/escalations/${id}/thread`);
  return res.json();
}

/** Paso 1: el motor compone un borrador desde el volcado del equipo. No envía.
 *  Lanza ApiError; 404/409 = la duda cambió de estado (la maneja el componente). */
export async function composeReply(id: string, respuesta: string): Promise<ComposeResult> {
  const res = await apiFetch(`/api/escalations/${id}/compose`, {
    method: "POST",
    json: { respuesta },
  });
  return res.json();
}

/** Paso 2: envía el texto EXACTO revisado al cliente. Devuelve el estado (sent/
 *  taken/standby/error) incluso en 409/502 — esos son flujos esperados, no throw.
 *  Un 401 (token vencido) SÍ propaga → logout global. */
export async function sendReply(id: string, message: string, rawInput = ""): Promise<SendResult> {
  try {
    const res = await apiFetch(`/api/escalations/${id}/send`, {
      method: "POST",
      json: { message, raw_input: rawInput },
    });
    return res.json();
  } catch (e) {
    // Solo los estados esperados (409 taken/standby, 502 error de envío) se
    // devuelven como SendResult; el resto (401/500/red) propaga.
    if (e instanceof ApiError && (e.status === 409 || e.status === 502)
        && e.data && typeof e.data === "object" && "status" in e.data) {
      return e.data as SendResult;
    }
    throw e;
  }
}

/** 'Esto lo manejo yo directo' — saca a Kira de pausa sin enviar. */
export async function declineEscalation(id: string): Promise<void> {
  await apiFetch(`/api/escalations/${id}/decline`, { method: "POST" });
}

// ============================================================
// LECCIONES DE KIRA — lo que aprendió y espera tu OK (S288)
// Las lecciones nacen `pending` (gobernanza S109: nada se inyecta al prompt sin
// revisión humana). Hasta hoy sólo se aprobaban por API.
// ============================================================

export interface KiraLearning {
  id: number;
  category: string;
  lesson: string;
  context?: string | null;
  status: "pending" | "approved" | "rejected";
  created_at?: string;
}

export async function listKiraLearnings(status = "pending"): Promise<{ learnings: KiraLearning[]; counts: Record<string, number> }> {
  const res = await apiFetch(`/api/kira/learnings?status=${encodeURIComponent(status)}&limit=50`);
  const data = await res.json();
  return { learnings: Array.isArray(data.learnings) ? data.learnings : [], counts: data.counts || {} };
}

export async function approveKiraLearning(id: number): Promise<void> {
  await apiFetch(`/api/kira/learnings/${id}/approve`, { method: "POST" });
}

export async function rejectKiraLearning(id: number, note = ""): Promise<void> {
  await apiFetch(`/api/kira/learnings/${id}/reject`, { method: "POST", json: { note } });
}

// ============================================================
// SKILLS PROPUESTAS POR NOA — procedimientos que esperan tu OK (S308)
// Nacen `pending`; aprobar manda el body_sha que se mostró (el servidor rechaza
// si el cuerpo cambió) y rechazar exige una nota para que Noa no lo repita.
// ============================================================

export interface SkillProposal {
  id: string;
  name: string;
  agent: "noa" | "kira" | "all";
  description: string;
  body: string;
  body_sha: string;
  version: number;
  status: "pending" | "approved" | "rejected" | "archived";
  origin?: string;
  replaces_id?: string | null;
  reason?: string | null;
  proposed_by?: string | null;
  created_at?: string;
}

export async function listSkillProposals(status = "pending"): Promise<{ skills: SkillProposal[]; counts: Record<string, number> }> {
  const res = await apiFetch(`/api/skills?status=${encodeURIComponent(status)}&limit=50`);
  const data = await res.json();
  return { skills: Array.isArray(data.skills) ? data.skills : [], counts: data.counts || {} };
}

export async function approveSkillProposal(id: string, bodySha: string): Promise<void> {
  await apiFetch(`/api/skills/${id}/approve`, { method: "POST", json: { body_sha: bodySha } });
}

export async function rejectSkillProposal(id: string, note: string): Promise<void> {
  await apiFetch(`/api/skills/${id}/reject`, { method: "POST", json: { note } });
}

// ============================================================
// ATLAS v2 (S331): propuestas de ads que esperan la decisión de Jesús.
// Aprobar manda `expected_hash` (lo que se mostró); el servidor devuelve el estado
// DURABLE (executed / failed / uncertain) — `uncertain` reserva el recurso hasta reconciliar.
// ============================================================
export interface AtlasProposal {
  id: number;
  platform: "meta" | "google";
  account_id: string;
  target_type: string;
  target_id: string;
  target_name: string | null;
  action_type: string;
  reasoning: string;
  expected_impact: string | null;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | null;
  status: string;
  exec_state: string | null;
  expected_hash: string;
  resource_key: string | null;
  proposed_at: string;
  approved_at: string | null;
  approved_by: string | null;
  seen_at: string | null;
  money_at_stake_usd: number;
  precondition: {
    previous_daily_budget_usd?: number | null;
    new_daily_budget_usd?: number | null;
    status_before?: string | null;
    keywords?: string[] | null;
    match_type?: string | null;
  };
  snapshot_metrics: Record<string, unknown>;
  execution_result?: Record<string, unknown> | null;
}

export interface AtlasProposalsResponse {
  proposals: AtlasProposal[];
  more: number;
  next_cursor: string | null;
  attention: AtlasProposal[];
  counts: { pending_total: number; attention: number };
}

export interface AtlasDecision {
  ok: boolean;
  id: number;
  status: string;
  exec_state?: string | null;
  persisted?: boolean;
  needs_reconcile?: boolean;
  error?: string | null;
  observed?: string;
}

export async function listAtlasProposals(limit = 3, after = ""): Promise<AtlasProposalsResponse> {
  const q = new URLSearchParams({ limit: String(limit) });
  if (after) q.set("after", after);
  const res = await apiFetch(`/api/atlas/proposals?${q.toString()}`);
  return (await res.json()) as AtlasProposalsResponse;
}

export async function getAtlasProposal(id: number): Promise<AtlasProposal> {
  const res = await apiFetch(`/api/atlas/proposals/${id}`);
  return (await res.json()) as AtlasProposal;
}

export async function markAtlasProposalSeen(id: number): Promise<void> {
  await apiFetch(`/api/atlas/proposals/${id}/seen`, { method: "POST", json: {} });
}

export async function approveAtlasProposal(id: number, expectedHash: string): Promise<AtlasDecision> {
  const res = await apiFetch(`/api/atlas/proposals/${id}/approve`, { method: "POST", json: { expected_hash: expectedHash } });
  return (await res.json()) as AtlasDecision;
}

export async function rejectAtlasProposal(id: number, note: string): Promise<AtlasDecision> {
  const res = await apiFetch(`/api/atlas/proposals/${id}/reject`, { method: "POST", json: { note } });
  return (await res.json()) as AtlasDecision;
}

export async function reconcileAtlasProposal(id: number): Promise<AtlasDecision> {
  const res = await apiFetch(`/api/atlas/proposals/${id}/reconcile`, { method: "POST", json: {} });
  return (await res.json()) as AtlasDecision;
}

// ============================================================
// CHAT STREAMING
// ============================================================

export interface StreamEvent {
  type: "delta" | "tool_call" | "tool_result" | "card" | "done" | "error" | "hint" | "image";
  data: unknown;
}

/**
 * Streaming chat call.
 * El backend devuelve text/event-stream con eventos SSE.
 */
export async function* streamMessage(
  payload: SendMessagePayload,
  signal?: AbortSignal,
): AsyncIterableIterator<StreamEvent> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  } else {
    headers["X-API-Key"] = API_KEY;
  }

  const res = await fetch(`${API_BASE}/api/chat/stream`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    signal,
  });

  if (!res.ok || !res.body) {
    let detail = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      if (data?.detail) detail = String(data.detail);
    } catch {
      /* noop */
    }
    if (res.status === 401) handleUnauthorized();
    throw new ApiError(res.status, detail);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Procesar eventos SSE línea por línea
    let idx: number;
    // P2-4 audit: directive removed (rule not active in current eslint config)
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const rawEvent = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 2);

      if (!rawEvent) continue;

      // Parsear líneas SSE: `event: type` y `data: json`
      let eventType = "message";
      let dataStr = "";
      for (const line of rawEvent.split("\n")) {
        if (line.startsWith("event:")) eventType = line.slice(6).trim();
        else if (line.startsWith("data:")) dataStr += line.slice(5).trim();
      }

      if (!dataStr) continue;

      try {
        const data = JSON.parse(dataStr);
        yield { type: (eventType as StreamEvent["type"]) || data.type || "delta", data };
      } catch {
        yield { type: "delta", data: dataStr };
      }
    }
  }
}

// ============================================================
// IMAGES / GALLERY
// ============================================================

export async function listImages(
  opts: { limit?: number; before?: string; hidden?: boolean } = {},
): Promise<{
  items: ChatImage[];
  next_cursor?: string | null;
}> {
  const params = new URLSearchParams();
  if (opts.limit) params.set("limit", String(opts.limit));
  if (opts.before) params.set("before", opts.before);
  if (opts.hidden) params.set("hidden", "true");
  const res = await apiFetch(`/api/chat/images?${params}`);
  return res.json();
}

export async function hideImage(messageId: string, hidden: boolean): Promise<void> {
  await apiFetch(`/api/chat/images/${messageId}/hide`, {
    method: "PATCH",
    json: { hidden },
  });
}

export async function deleteImage(messageId: string): Promise<void> {
  await apiFetch(`/api/chat/images/${messageId}`, { method: "DELETE" });
}

/** S163: blob de una imagen del CDN vía proxy de la API.
 *  cdn.koai360.com no expone CORS → fetch directo falla cross-origin; el
 *  proxy /api/chat/images/download la sirve con CORS del API. */
export async function fetchImageBlob(url: string): Promise<Blob> {
  const res = await apiFetch(
    `/api/chat/images/download?url=${encodeURIComponent(url)}`,
  );
  return res.blob();
}

export async function rateImage(messageId: string, rating: 1 | 2 | 3 | 4 | 5): Promise<void> {
  await apiFetch(`/api/chat/images/${messageId}/like`, {
    method: "POST",
    json: { rating },
  });
}

export async function unrateImage(messageId: string): Promise<void> {
  await apiFetch(`/api/chat/images/${messageId}/like`, { method: "DELETE" });
}

export async function fetchRatingsMap(): Promise<Record<string, 1 | 2 | 3 | 4 | 5>> {
  const res = await apiFetch("/api/chat/images/likes/ratings");
  return res.json();
}

// ============================================================
// PRIVATE GALLERY (PIN)
// ============================================================

export async function fetchPrivateStatus(): Promise<{ has_pin: boolean }> {
  const res = await apiFetch("/api/chat/private/status");
  return res.json();
}

export async function verifyPrivatePin(pin: string): Promise<boolean> {
  try {
    const res = await apiFetch("/api/chat/private/verify-pin", {
      method: "POST",
      json: { pin },
      // 401 acá = "PIN incorrecto", NO sesión inválida — sin esto un PIN mal
      // tipeado deslogueaba de TODA la app (P1 audit S158-b)
      skip401Handler: true,
    });
    const data = await res.json();
    return data.ok === true;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return false;
    throw err;
  }
}

export async function setPrivatePin(pin: string, oldPin?: string): Promise<void> {
  await apiFetch("/api/chat/private/set-pin", {
    method: "POST",
    json: oldPin ? { pin, old_pin: oldPin } : { pin },
    skip401Handler: true, // 401 = old_pin incorrecto, no sesión inválida
  });
}

// ============================================================
// USER MEMORIES
// ============================================================

export async function listMemories(): Promise<UserMemory[]> {
  const res = await apiFetch("/api/chat/user-memories");
  const data = await res.json();
  return Array.isArray(data) ? data : data.items || [];
}

export async function createMemory(type: string, content: string): Promise<UserMemory> {
  const res = await apiFetch("/api/chat/user-memories", {
    method: "POST",
    json: { type, content },
  });
  return res.json();
}

export async function deleteMemory(id: string): Promise<void> {
  await apiFetch(`/api/chat/user-memories/${id}`, { method: "DELETE" });
}

// P2-5 audit: transcribeAudio era usada solo por VoiceModal (dead code, removed).
// El flow de voz live usa Deepgram streaming via WS (useDeepgramStream), no POST blob.

// ============================================================
// PUSH NOTIFICATIONS (S232)
// ============================================================

export async function getVapidKey(): Promise<string> {
  const res = await apiFetch("/api/push/vapid-key");
  const data = (await res.json()) as { publicKey?: string };
  if (!data.publicKey) {
    throw new ApiError(500, "El backend no tiene las claves VAPID configuradas");
  }
  return data.publicKey;
}

/** Registra el endpoint del navegador para que el backend pueda empujarle. */
export async function savePushSubscription(sub: PushSubscriptionJSON): Promise<void> {
  await apiFetch("/api/push/subscribe", {
    method: "POST",
    json: { endpoint: sub.endpoint, keys: sub.keys ?? {} },
  });
}

export async function deletePushSubscription(sub: PushSubscriptionJSON): Promise<void> {
  await apiFetch("/api/push/subscribe", {
    method: "DELETE",
    json: { endpoint: sub.endpoint, keys: sub.keys ?? {} },
  });
}
