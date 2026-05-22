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
}

async function apiFetch(path: string, opts: FetchOpts = {}): Promise<Response> {
  const { json, skipAuth, headers, ...rest } = opts;

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
    // eslint-disable-next-line no-cond-assign
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

export async function listImages(opts: { limit?: number; before?: string } = {}): Promise<{
  items: ChatImage[];
  next_cursor?: string | null;
}> {
  const params = new URLSearchParams();
  if (opts.limit) params.set("limit", String(opts.limit));
  if (opts.before) params.set("before", opts.before);
  const res = await apiFetch(`/api/chat/images?${params}`);
  return res.json();
}

export async function deleteImage(messageId: string): Promise<void> {
  await apiFetch(`/api/chat/images/${messageId}`, { method: "DELETE" });
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

// ============================================================
// AUDIO TRANSCRIBE
// ============================================================

export async function transcribeAudio(blob: Blob): Promise<{ text: string }> {
  const fd = new FormData();
  fd.append("file", blob, "audio.webm");
  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  } else {
    headers["X-API-Key"] = API_KEY;
  }
  const res = await fetch(`${API_BASE}/api/transcribe`, {
    method: "POST",
    headers,
    body: fd,
  });
  if (!res.ok) throw new ApiError(res.status, `transcribe failed`);
  return res.json();
}
