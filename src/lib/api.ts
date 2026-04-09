import { API_URL, API_KEY, getAuthToken } from "../config";

function getHeaders(): Record<string, string> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  } else {
    headers["X-API-Key"] = API_KEY;
  }
  return headers;
}

export async function sendKiraMessage(
  message: string,
  conversationId?: string,
  imageBase64?: string,
  imageMode?: boolean,
  imageEngine?: string,
  editMode?: boolean,
): Promise<{ conversation_id: string; messages: Array<{ role: string; agent: string; content: string; image?: string }> }> {
  const body: Record<string, unknown> = {
    message,
    agent: "kira",
    conversation_id: conversationId,
  };
  if (imageBase64) body.image_base64 = imageBase64;
  if (imageMode) body.image_mode = true;
  if (imageEngine) body.image_engine = imageEngine;
  if (editMode) body.edit_mode = true;

  // Timeout por modo:
  // - edit_mode: BFL Kontext Pro ~8s + fallback Modal ~45s → 180_000ms
  // - flux2: 32B premium, cold ~120s → 240_000ms
  // - zimage / studioflux-raw: Z-Image-Turbo ~5-30s warm, ~60s cold → 180_000ms
  // - gemini: ~3s → 60_000ms
  const timeoutMs = editMode
    ? 180_000
    : imageMode
      ? imageEngine === "flux2" ? 240_000
      : (imageEngine === "zimage" || imageEngine === "studioflux-raw") ? 180_000
      : 60_000
    : 60_000;

  const MAX_RETRIES = 1;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Kira error: ${res.status}`);
      return res.json();
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new Error(imageMode
          ? imageEngine === "flux2"
            ? "Flux.2 Pro tardó demasiado (cold start del GPU). Reintenta — el segundo intento es ~5x más rápido. O usa Z-Image para velocidad."
            : imageEngine === "zimage" || imageEngine === "studioflux" || imageEngine === "studioflux-raw"
              ? "El GPU está calentándose (cold start). Reintenta en unos segundos — los siguientes serán inmediatos."
              : "La generación tardó demasiado. Intenta de nuevo o usa el motor Rápido (Gemini)."
          : "La solicitud tardó demasiado. Intenta de nuevo.");
      }
      // Retry once on network errors (Safari "Load failed", Chrome "Failed to fetch")
      if (err instanceof TypeError && attempt < MAX_RETRIES) {
        console.warn(`[API] Network error, retrying (${attempt + 1}/${MAX_RETRIES})...`);
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      if (err instanceof TypeError) {
        throw new Error("No se pudo conectar al servidor. Verifica tu conexión e intenta de nuevo.");
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error("No se pudo conectar al servidor.");
}

export async function streamKronosMessage(
  message: string,
  history: Array<{ role: string; content: string }>,
  conversationId?: string,
  onChunk: (text: string) => void = () => {},
  imageBase64?: string,
): Promise<string> {
  const body: Record<string, unknown> = {
    message,
    history,
    conversation_id: conversationId,
  };
  if (imageBase64) body.image_base64 = imageBase64;

  const res = await fetch(`${API_URL}/api/chat/kronos`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Kronos error: ${res.status}`);

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No stream");

  const decoder = new TextDecoder();
  let fullText = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6);
      if (data === "[DONE]") continue;

      try {
        const parsed = JSON.parse(data);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) {
          fullText += content;
          onChunk(fullText);
        }
      } catch {
        // ignore parse errors
      }
    }
  }

  return fullText;
}

export interface ImageMetadataPayload {
  engine: string;
  generation_time_ms?: number;
  cost_estimate_usd?: number;
}

export interface KiraStreamCallbacks {
  onToken: (accumulated: string) => void;
  onImage?: (base64: string, metadata?: ImageMetadataPayload) => void;
  onAgent?: (agent: string) => void;
}

export type ThinkingLevel = "low" | "medium" | "high";

export async function streamKiraMessage(
  message: string,
  conversationId?: string,
  imageBase64?: string,
  imageMode?: boolean,
  imageEngine?: string,
  callbacks: KiraStreamCallbacks = { onToken: () => {} },
  signal?: AbortSignal,
  thinkingLevel: ThinkingLevel = "medium",
  editMode?: boolean,
): Promise<{ conversation_id: string; agent_used: string; fullText: string; image?: string; imageMetadata?: ImageMetadataPayload }> {
  const body: Record<string, unknown> = {
    message,
    agent: "kira",
    conversation_id: conversationId,
    thinking_level: thinkingLevel,
  };
  if (imageBase64) body.image_base64 = imageBase64;
  if (imageMode) body.image_mode = true;
  if (imageEngine) body.image_engine = imageEngine;
  if (editMode) body.edit_mode = true;

  // Timeout por modo:
  // - edit_mode: BFL Pro ~8s + fallback Modal ~45s → 180_000ms
  // - flux2: 32B premium → 240_000ms
  // - zimage/studioflux-raw: ~5-60s → 180_000ms
  // - resto: 120_000ms
  const isStudio = imageEngine === "studioflux-raw" || imageEngine === "zimage";
  const timeoutMs = editMode
    ? 180_000
    : imageMode
      ? imageEngine === "flux2" ? 240_000
      : isStudio ? 180_000
      : 90_000
    : 120_000;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  // Si el caller pasó un signal externo, hacerlo chain con el controller interno
  // (permite cancelación manual desde useChat sin perder el timeout interno)
  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener("abort", () => controller.abort(), { once: true });
    }
  }

  try {
    const res = await fetch(`${API_URL}/api/chat/stream`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) throw new Error(`Kira stream error: ${res.status}`);

    const reader = res.body?.getReader();
    if (!reader) throw new Error("No stream body");

    const decoder = new TextDecoder();
    let buffer = "";
    let fullText = "";
    let image: string | undefined;
    let imageMetadata: ImageMetadataPayload | undefined;
    let conversationIdResult = conversationId || "";
    let agentUsed = "kira";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      let currentEvent = "";
      for (const line of lines) {
        if (line.startsWith("event: ")) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith("data: ")) {
          const data = line.slice(6);
          try {
            const parsed = JSON.parse(data);

            if (currentEvent === "token" && parsed.text) {
              fullText += parsed.text;
              callbacks.onToken(fullText);
            } else if (currentEvent === "image" && parsed.image) {
              // image puede ser URL pública o base64 (fallback)
              image = parsed.image;
              imageMetadata = parsed.metadata as ImageMetadataPayload | undefined;
              callbacks.onImage?.(parsed.image, imageMetadata);
            } else if (currentEvent === "agent" && parsed.agent) {
              agentUsed = parsed.agent;
              callbacks.onAgent?.(parsed.agent);
            } else if (currentEvent === "done") {
              conversationIdResult = parsed.conversation_id || conversationIdResult;
              agentUsed = parsed.agent_used || agentUsed;
            } else if (currentEvent === "error") {
              throw new Error(parsed.error || "Error del servidor");
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
          currentEvent = "";
        }
      }
    }

    return { conversation_id: conversationIdResult, agent_used: agentUsed, fullText, image, imageMetadata };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(imageMode
        ? "La generación tardó demasiado. Intenta de nuevo."
        : "La solicitud tardó demasiado. Intenta de nuevo.");
    }
    if (err instanceof TypeError) {
      throw new Error("No se pudo conectar al servidor. Verifica tu conexión.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function transcribeAudio(audioBlob: Blob): Promise<string> {
  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  } else {
    headers["X-API-Key"] = API_KEY;
  }

  const formData = new FormData();
  // Map mime type to file extension for Whisper compatibility
  const type = audioBlob.type || "audio/webm";
  let ext = "webm";
  if (type.includes("mp4") || type.includes("m4a")) ext = "m4a";
  else if (type.includes("ogg")) ext = "ogg";
  else if (type.includes("aac")) ext = "aac";
  else if (type.includes("wav")) ext = "wav";

  console.log(`[Transcribe] Sending ${audioBlob.size} bytes, type: ${type}, ext: ${ext}`);
  formData.append("file", audioBlob, `recording.${ext}`);

  const res = await fetch(`${API_URL}/api/chat/transcribe`, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `Error ${res.status}` }));
    throw new Error(err.detail || `Transcripción error: ${res.status}`);
  }

  const data = await res.json();
  return data.text;
}

// --- Conversation persistence ---

export interface ServerConversation {
  id: string;
  agent: string;
  title: string;
  project_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ServerMessage {
  id: string;
  role: string;
  agent: string;
  content: string;
  image: string | null;
  created_at: string;
}

export async function fetchConversations(): Promise<ServerConversation[]> {
  const res = await fetch(`${API_URL}/api/chat/conversations`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

export async function createConversation(agent: string, title: string): Promise<ServerConversation> {
  const res = await fetch(`${API_URL}/api/chat/conversations`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ agent, title }),
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

export async function updateConversationTitle(id: string, title: string): Promise<void> {
  await fetch(`${API_URL}/api/chat/conversations/${id}`, {
    method: "PATCH",
    headers: getHeaders(),
    body: JSON.stringify({ title }),
  });
}

export async function deleteConversationApi(id: string): Promise<void> {
  await fetch(`${API_URL}/api/chat/conversations/${id}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
}

export async function fetchMessages(conversationId: string): Promise<ServerMessage[]> {
  const res = await fetch(`${API_URL}/api/chat/conversations/${conversationId}/messages`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

export async function saveMessages(
  conversationId: string,
  messages: Array<{ role: string; agent: string; content: string; image?: string }>,
): Promise<void> {
  await fetch(`${API_URL}/api/chat/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ messages }),
  });
}

export async function deleteMessages(conversationId: string, messageIds: string[]): Promise<void> {
  await fetch(`${API_URL}/api/chat/conversations/${conversationId}/messages`, {
    method: "DELETE",
    headers: getHeaders(),
    body: JSON.stringify({ message_ids: messageIds }),
  });
}

// --- Projects ---

export interface ServerProject {
  id: string;
  name: string;
  icon: string;
  created_at: string;
  updated_at: string;
}

export async function fetchProjects(): Promise<ServerProject[]> {
  const res = await fetch(`${API_URL}/api/chat/projects`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

export async function createProject(name: string, icon = "📁"): Promise<ServerProject> {
  const res = await fetch(`${API_URL}/api/chat/projects`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ name, icon }),
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

export async function updateProject(id: string, data: { name?: string; icon?: string }): Promise<void> {
  await fetch(`${API_URL}/api/chat/projects/${id}`, {
    method: "PATCH",
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
}

export async function deleteProject(id: string): Promise<void> {
  await fetch(`${API_URL}/api/chat/projects/${id}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
}

export async function assignConversationProject(conversationId: string, projectId: string | null): Promise<void> {
  await fetch(`${API_URL}/api/chat/conversations/${conversationId}/project`, {
    method: "PATCH",
    headers: getHeaders(),
    body: JSON.stringify({ project_id: projectId }),
  });
}

// --- Gallery ---

export interface GalleryImage {
  id: string;
  image: string;
  content: string;
  created_at: string;
  engine?: string;
}

export interface GalleryPage {
  items: GalleryImage[];
  next_cursor: string | null;
}

export interface FetchImagesOpts {
  limit?: number;
  before?: string | null;
  signal?: AbortSignal;
}

/**
 * Fetch paginado de la galería. Usa cursor pagination con `before` (ISO ts).
 * Backend (chat_persistence.py:list_images) filtra por URLs (no base64) y
 * devuelve { items, next_cursor }.
 */
export async function fetchImages(opts: FetchImagesOpts = {}): Promise<GalleryPage> {
  const { limit = 24, before = null, signal } = opts;
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  if (before) params.set("before", before);

  const res = await fetch(`${API_URL}/api/chat/images?${params.toString()}`, {
    headers: getHeaders(),
    signal,
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

/**
 * Helper: convierte una URL de Supabase Storage a thumbnail con transformación.
 *
 * Si la URL es de Supabase Storage (`/storage/v1/object/public/`), inserta el
 * path de transformaciones `/storage/v1/render/image/public/` con `?width=N`.
 * Para otras URLs (third-party CDN, base64 legacy), devuelve sin tocar.
 *
 * Reduce el tamaño servido de ~1-2MB original a ~50-150KB para thumbnails 600px.
 */
export function getImageThumbUrl(url: string, width = 600, quality = 85): string {
  if (!url || !url.includes("supabase.co/storage/v1/object/public/")) {
    return url;
  }
  // Reescribir path de "object/public" a "render/image/public" + query params
  const transformed = url.replace(
    "/storage/v1/object/public/",
    "/storage/v1/render/image/public/",
  );
  return `${transformed}?width=${width}&quality=${quality}&resize=contain`;
}

export async function deleteImage(messageId: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/chat/images/${messageId}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
}

// --- Notifications ---

export interface Notification {
  id: string;
  title: string;
  body?: string;
  message?: string;
  url?: string;
  read: boolean;
  created_at: string;
}

export async function fetchNotifications(): Promise<Notification[]> {
  const res = await fetch(`${API_URL}/api/notifications`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

export async function markNotificationRead(id: string): Promise<void> {
  await fetch(`${API_URL}/api/notifications/${id}/read`, {
    method: "PATCH",
    headers: getHeaders(),
  });
}

export async function markAllNotificationsRead(): Promise<void> {
  await fetch(`${API_URL}/api/notifications/read-all`, {
    method: "PATCH",
    headers: getHeaders(),
  });
}

export async function deleteNotification(id: string): Promise<void> {
  await fetch(`${API_URL}/api/notifications/${id}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
}

export async function deleteAllNotifications(): Promise<void> {
  await fetch(`${API_URL}/api/notifications`, {
    method: "DELETE",
    headers: getHeaders(),
  });
}

// --- Kronos Mobile: Briefs ---
export interface KronosBrief {
  id: string;
  title: string;
  summary: string;
  full_context?: string;
  priority: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  notes?: string;
}

export async function fetchBriefs(status?: string): Promise<KronosBrief[]> {
  const params = status ? `?status=${status}` : "";
  const res = await fetch(`${API_URL}/api/kronos/briefs${params}`, { headers: getHeaders() });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

export async function updateBrief(id: string, data: { status?: string; notes?: string }): Promise<KronosBrief> {
  const res = await fetch(`${API_URL}/api/kronos/briefs/${id}`, {
    method: "PATCH",
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

// --- Kronos Mobile: System Status ---
export interface SystemStatus {
  vps: {
    cpu_percent: number;
    ram_used_gb: number;
    ram_total_gb: number;
    swap_used_gb: number;
    uptime_hours: number;
    disk_used_gb: number;
    disk_total_gb: number;
  };
  services: Record<string, string>;
  last_checked: string;
}

export async function fetchSystemStatus(): Promise<SystemStatus> {
  const res = await fetch(`${API_URL}/api/kronos/system-status`, { headers: getHeaders() });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

// --- Kronos Mobile: Memory ---
export interface KronosMemory {
  id: string;
  type: string;
  title: string;
  content: string;
  tags: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

export async function fetchMemories(type?: string): Promise<KronosMemory[]> {
  const params = type ? `?type=${type}` : "";
  const res = await fetch(`${API_URL}/api/kronos/memory${params}`, { headers: getHeaders() });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

export async function createMemory(data: { type: string; title: string; content: string; tags?: string[] }): Promise<KronosMemory> {
  const res = await fetch(`${API_URL}/api/kronos/memory`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

export async function deleteMemory(id: string): Promise<void> {
  await fetch(`${API_URL}/api/kronos/memory/${id}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
}


// ─── User Memories ───────────────────────────────────────────────────────────

export interface UserMemory {
  id: string;
  type: "preference" | "context" | "fact" | "instruction";
  content: string;
  source: string;
  agent: string;
  relevance_score: number;
  created_at: string;
  updated_at: string;
}

export async function fetchUserMemories(type?: string): Promise<UserMemory[]> {
  const params = type && type !== "all" ? `?type=${type}` : "";
  const res = await fetch(`${API_URL}/api/chat/user-memories${params}`, { headers: getHeaders() });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

export async function createUserMemory(data: { type: string; content: string }): Promise<UserMemory> {
  const res = await fetch(`${API_URL}/api/chat/user-memories`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

export async function deleteUserMemory(id: string): Promise<void> {
  await fetch(`${API_URL}/api/chat/user-memories/${id}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
}

// ─── Message Feedback ───

export async function sendMessageFeedback(data: {
  message_id: string;
  conversation_id: string;
  rating: "up" | "down";
  message_content: string;
  agent: string;
}): Promise<void> {
  const res = await fetch(`${API_URL}/api/chat/feedback`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    console.error("[Feedback] Error:", res.status);
  }
}
