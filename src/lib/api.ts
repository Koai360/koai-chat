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
): Promise<{ conversation_id: string; messages: Array<{ role: string; agent: string; content: string; image?: string }> }> {
  const body: Record<string, unknown> = {
    message,
    agent: "kira",
    conversation_id: conversationId,
  };
  if (imageBase64) body.image_base64 = imageBase64;
  if (imageMode) body.image_mode = true;
  if (imageEngine) body.image_engine = imageEngine;

  // Timeout largo para generación de imágenes (Flux puede tomar ~40s)
  const timeoutMs = imageMode ? 90_000 : 60_000;
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
        ? "La generación de imagen tardó demasiado. Intenta de nuevo o usa el motor Rápido (Gemini)."
        : "La solicitud tardó demasiado. Intenta de nuevo.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
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
}

export async function fetchImages(): Promise<GalleryImage[]> {
  const res = await fetch(`${API_URL}/api/chat/images`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
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
