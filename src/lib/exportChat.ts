import type { Message } from "@/hooks/useChat";
import { triggerDownload } from "./cfTransform";
import { API_URL, getAuthToken } from "../config";

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Exporta una conversación como archivo de texto plano.
 */
export function exportAsText(title: string, messages: Message[]): void {
  const lines = [`# ${title}`, `Exportado: ${new Date().toLocaleDateString("es-ES")}`, ""];

  for (const msg of messages) {
    const who = msg.role === "user" ? "Tú" : msg.agent === "kronos" ? "Kronos" : "Noa";
    const time = formatTimestamp(msg.timestamp);
    lines.push(`[${time}] ${who}:`);
    lines.push(msg.content);
    if (msg.image) lines.push(`[Imagen: ${msg.image}]`);
    lines.push("");
  }

  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const filename = `${title.replace(/[^a-zA-Z0-9áéíóúñ ]/g, "").slice(0, 40)}.txt`;

  // Mobile: share API; Desktop: download
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (isMobile && navigator.canShare) {
    const file = new File([blob], filename, { type: "text/plain" });
    if (navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file] }).catch(() => {});
      URL.revokeObjectURL(url);
      return;
    }
  }

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
}

/**
 * Exporta una conversación como PDF usando el endpoint de generate_document_pdf.
 */
export async function exportAsPdf(title: string, messages: Message[]): Promise<void> {
  // Formatear mensajes como markdown para el PDF
  const lines = [`# ${title}`, ""];

  for (const msg of messages) {
    const who = msg.role === "user" ? "**Tú**" : msg.agent === "kronos" ? "**Kronos**" : "**Noa**";
    const time = formatTimestamp(msg.timestamp);
    lines.push(`### ${who} — ${time}`);
    lines.push(msg.content);
    if (msg.image) lines.push(`\n![Imagen](${msg.image})\n`);
    lines.push("---");
    lines.push("");
  }

  const content = lines.join("\n");

  const token = getAuthToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  else headers["X-API-Key"] = "koai-dev-2026";

  const res = await fetch(`${API_URL}/api/documents/generate-pdf`, {
    method: "POST",
    headers,
    body: JSON.stringify({ title, content, author: "Noa AI" }),
  });

  if (!res.ok) throw new Error(`Error generando PDF: ${res.status}`);

  const data = await res.json();
  const pdfUrl = data.url || data.download_url;
  if (!pdfUrl) throw new Error("No se recibió URL del PDF");

  await triggerDownload(pdfUrl, `${title.slice(0, 30)}.pdf`);
}
