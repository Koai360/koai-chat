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
