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

export async function sendNoaMessage(
  message: string,
  conversationId?: string,
  imageBase64?: string,
  imageMode?: boolean,
  imageEngine?: string,
  editMode?: boolean,
): Promise<{ conversation_id: string; messages: Array<{ role: string; agent: string; content: string; image?: string }> }> {
  const body: Record<string, unknown> = {
    message,
    agent: "noa",
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
      if (!res.ok) throw new Error(`Noa error: ${res.status}`);
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

export interface NoaStreamCallbacks {
  onToken: (accumulated: string) => void;
  onImage?: (base64: string, metadata?: ImageMetadataPayload) => void;
  onAgent?: (agent: string) => void;
}

export type ThinkingLevel = "low" | "medium" | "high";

export async function streamNoaMessage(
  message: string,
  conversationId?: string,
  imageBase64?: string,
  imageMode?: boolean,
  imageEngine?: string,
  callbacks: NoaStreamCallbacks = { onToken: () => {} },
  signal?: AbortSignal,
  thinkingLevel: ThinkingLevel = "medium",
  editMode?: boolean,
  imageUrl?: string,
): Promise<{ conversation_id: string; agent_used: string; fullText: string; image?: string; imageMetadata?: ImageMetadataPayload; memory_usage?: number }> {
  const body: Record<string, unknown> = {
    message,
    agent: "noa",
    conversation_id: conversationId,
    thinking_level: thinkingLevel,
  };
  if (imageBase64) body.image_base64 = imageBase64;
  if (imageUrl) body.image_url = imageUrl;
  if (imageMode) body.image_mode = true;
  if (imageEngine) body.image_engine = imageEngine;
  if (editMode) body.edit_mode = true;

  // Timeout por modo:
  // - edit_mode: BFL Pro ~8s + fallback Modal ~45s → 180_000ms
  // - flux2: 32B premium → 240_000ms
  // - zimage/studioflux-raw: ~5-60s → 180_000ms
  // - resto: 120_000ms
  const isStudio = imageEngine === "studioflux-raw" || imageEngine === "zimage";
  const isSdxl = imageEngine === "sdxl" || imageEngine?.startsWith("sdxl-");
  const timeoutMs = editMode
    ? 180_000
    : imageMode
      ? imageEngine === "flux2" ? 240_000
      : isStudio || isSdxl ? 180_000
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

    if (!res.ok) throw new Error(`Noa stream error: ${res.status}`);

    const reader = res.body?.getReader();
    if (!reader) throw new Error("No stream body");

    const decoder = new TextDecoder();
    let buffer = "";
    let fullText = "";
    let image: string | undefined;
    let imageMetadata: ImageMetadataPayload | undefined;
    let conversationIdResult = conversationId || "";
    let agentUsed = "noa";
    let memoryUsage: number | undefined;

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
              if (typeof parsed.memory_usage === "number") memoryUsage = parsed.memory_usage;
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

    return { conversation_id: conversationIdResult, agent_used: agentUsed, fullText, image, imageMetadata, memory_usage: memoryUsage };
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
  messages: Array<{ role: string; agent: string; content: string; image?: string; engine?: string }>,
): Promise<void> {
  await fetch(`${API_URL}/api/chat/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ messages }),
  });
}

/**
 * Intenta recuperar la última respuesta del servidor cuando el stream SSE
 * se perdió (iOS background, red intermitente). Busca si el backend ya
 * persistió un mensaje con imagen para esta conversación.
 */
export async function recoverLastAssistantMessage(
  conversationId: string,
): Promise<{ content: string; image?: string } | null> {
  try {
    const msgs = await fetchMessages(conversationId);
    if (!msgs.length) return null;
    // Buscar el último mensaje del assistant
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i];
      if (m.role === "assistant" && (m.content || m.image)) {
        return { content: m.content || "", image: m.image || undefined };
      }
    }
    return null;
  } catch {
    return null;
  }
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
  is_hidden?: boolean;
}

export interface GalleryPage {
  items: GalleryImage[];
  next_cursor: string | null;
}

export interface FetchImagesOpts {
  limit?: number;
  before?: string | null;
  signal?: AbortSignal;
  hidden?: boolean;
}

/**
 * Fetch paginado de la galería. Usa cursor pagination con `before` (ISO ts).
 * Backend (chat_persistence.py:list_images) filtra por URLs (no base64) y
 * devuelve { items, next_cursor }.
 */
export async function fetchImages(opts: FetchImagesOpts = {}): Promise<GalleryPage> {
  const { limit = 24, before = null, signal, hidden = false } = opts;
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  if (before) params.set("before", before);
  if (hidden) params.set("hidden", "true");

  const res = await fetch(`${API_URL}/api/chat/images?${params.toString()}`, {
    headers: getHeaders(),
    signal,
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

/**
 * @deprecated Usa `getCfTransformUrl(url, "thumb")` de `@/lib/cfTransform`.
 *
 * Este helper era para Supabase Storage Image Transformations, pero migramos
 * a Cloudflare R2 + CF Transformations el 2026-04-09. Se mantiene solo como
 * fallback para URLs legacy de Supabase durante la ventana de migración.
 *
 * Ver: src/lib/cfTransform.ts
 */
export function getImageThumbUrl(url: string, width = 600, quality = 85): string {
  if (!url || !url.includes("supabase.co/storage/v1/object/public/")) {
    return url;
  }
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

export async function hideImage(messageId: string, hidden: boolean): Promise<void> {
  const res = await fetch(`${API_URL}/api/chat/images/${messageId}/hide`, {
    method: "PATCH",
    headers: getHeaders(),
    body: JSON.stringify({ hidden }),
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
}

// --- Image Likes (style preference + futuro LoRA training) ---

export type StyleCategory = "anime" | "people" | "photo" | "art" | "design" | "uncategorized";

export const STYLE_CATEGORIES: { id: StyleCategory; label: string; icon: string }[] = [
  { id: "anime", label: "Anime", icon: "🎨" },
  { id: "people", label: "Personas", icon: "👤" },
  { id: "photo", label: "Fotografía", icon: "📷" },
  { id: "art", label: "Arte digital", icon: "✏️" },
  { id: "design", label: "Diseño", icon: "🎯" },
  { id: "uncategorized", label: "Sin categoría", icon: "📦" },
];

export interface ImageLike {
  id: string;
  message_id: string | null;
  rating: 1 | -1;
  prompt: string | null;
  engine: string | null;
  image_url: string | null;
  external_image_url?: string | null;
  source?: string | null;
  source_url?: string | null;
  category?: StyleCategory | null;
  params?: Record<string, unknown> | null;
  created_at: string;
}

export interface LikesResponse {
  items: ImageLike[];
  likes_count: number;
  dislikes_count: number;
  category_counts?: Record<string, number>;
  lora_ready: boolean;
}

// --- Civitai Import ---

export interface CivitaiPreview {
  image_id: string;
  image_url: string;
  width: number;
  height: number;
  prompt: string;
  negative_prompt: string;
  params: {
    cfg_scale?: number;
    steps?: number;
    sampler?: string;
    scheduler?: string;
    clip_skip?: number;
    width?: number;
    height?: number;
    seed?: number;
    model_name?: string;
    base_model?: string;
    loras?: Array<{ name: string; weight: number; hash?: string }>;
  };
  suggested_engine: string;
  suggested_category: StyleCategory;
}

export async function previewCivitai(url: string): Promise<CivitaiPreview> {
  const res = await fetch(`${API_URL}/api/chat/images/likes/import-civitai/preview`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ detail: "Error" }));
    throw new Error(data.detail || `Error ${res.status}`);
  }
  return res.json();
}

export async function importCivitai(
  url: string,
  category: StyleCategory,
): Promise<{ ok: boolean; category: string; engine: string; preview_url: string }> {
  const res = await fetch(`${API_URL}/api/chat/images/likes/import-civitai`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ url, category }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ detail: "Error" }));
    throw new Error(data.detail || `Error ${res.status}`);
  }
  return res.json();
}

export async function likeImage(messageId: string, rating: 1 | 2 | 3 | 4 | 5): Promise<void> {
  const res = await fetch(`${API_URL}/api/chat/images/${messageId}/like`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ rating }),
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
}

export async function unlikeImage(messageId: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/chat/images/${messageId}/like`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
}

/** Delete a like by its UUID (works for both PWA likes and Civitai imports). */
export async function deleteLike(likeId: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/chat/images/likes/${likeId}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
}

export async function fetchImageLikes(
  opts: { rating?: 1 | -1; category?: StyleCategory; limit?: number } = {},
): Promise<LikesResponse> {
  const params = new URLSearchParams();
  if (opts.rating !== undefined) params.set("rating", String(opts.rating));
  if (opts.category) params.set("category", opts.category);
  if (opts.limit) params.set("limit", String(opts.limit));
  const qs = params.toString();
  const res = await fetch(
    `${API_URL}/api/chat/images/likes${qs ? `?${qs}` : ""}`,
    { headers: getHeaders() },
  );
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

/** Cargar mapa de ratings {message_id: rating} para pre-poblar cache. */
export async function fetchRatingsMap(): Promise<Record<string, number>> {
  try {
    const res = await fetch(`${API_URL}/api/chat/images/likes/ratings`, {
      headers: getHeaders(),
    });
    if (!res.ok) return {};
    return res.json();
  } catch {
    return {};
  }
}

// --- Private Gallery PIN ---

export async function fetchPrivateStatus(): Promise<{ has_pin: boolean }> {
  const res = await fetch(`${API_URL}/api/chat/private/status`, {
    headers: getHeaders(),
  });
  if (!res.ok) return { has_pin: false };
  return res.json();
}

export async function setPrivatePin(pin: string, oldPin?: string): Promise<void> {
  const body: Record<string, string> = { pin };
  if (oldPin) body.old_pin = oldPin;
  const res = await fetch(`${API_URL}/api/chat/private/set-pin`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ detail: "Error" }));
    throw new Error(data.detail || `Error ${res.status}`);
  }
}

export async function verifyPrivatePin(pin: string): Promise<boolean> {
  const res = await fetch(`${API_URL}/api/chat/private/verify-pin`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ pin }),
  });
  return res.ok;
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

// ─── Notes (Scratchpad) ───

export interface Note {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export async function fetchNotes(): Promise<Note[]> {
  const res = await fetch(`${API_URL}/api/notes`, { headers: getHeaders() });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

export async function createNote(title: string, content: string): Promise<Note> {
  const res = await fetch(`${API_URL}/api/notes`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ title, content }),
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

export async function updateNote(id: string, title: string, content: string): Promise<void> {
  await fetch(`${API_URL}/api/notes/${id}`, {
    method: "PATCH",
    headers: getHeaders(),
    body: JSON.stringify({ title, content }),
  });
}

export async function deleteNote(id: string): Promise<void> {
  await fetch(`${API_URL}/api/notes/${id}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
}

// ─── Memory Palace ───

export interface Memory {
  id: string;
  entity_type: string;
  content: string;
  source: string | null;
  metadata: Record<string, unknown> | null;
  relevance_score: number | null;
  hit_count: number | null;
  last_hit_at: string | null;
  created_at: string;
}

export interface MemoryPalaceResponse {
  memories: Memory[];
  stats: {
    total: number;
    by_type: Record<string, number>;
    total_hits: number;
  };
}

export async function fetchMemoryPalace(
  entityType?: string,
): Promise<MemoryPalaceResponse> {
  const qs = entityType ? `?entity_type=${encodeURIComponent(entityType)}` : "";
  const res = await fetch(`${API_URL}/api/memory/palace${qs}`, { headers: getHeaders() });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

export async function deletePalaceMemory(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/memory/${id}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
}

export async function editPalaceMemory(id: string, content: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/memory/${id}`, {
    method: "PATCH",
    headers: getHeaders(),
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
}
