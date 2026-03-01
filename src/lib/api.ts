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
): Promise<{ conversation_id: string; messages: Array<{ role: string; agent: string; content: string }> }> {
  const res = await fetch(`${API_URL}/api/chat`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      message,
      agent: "kira",
      conversation_id: conversationId,
    }),
  });
  if (!res.ok) throw new Error(`Kira error: ${res.status}`);
  return res.json();
}

export async function streamKronosMessage(
  message: string,
  history: Array<{ role: string; content: string }>,
  conversationId?: string,
  onChunk: (text: string) => void = () => {},
): Promise<string> {
  const res = await fetch(`${API_URL}/api/chat/kronos`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      message,
      history,
      conversation_id: conversationId,
    }),
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
