/**
 * Card parser — detecta bloques ```card:type ... ``` en el contenido del mensaje
 * y devuelve un array de segmentos {text, card} para render mixto.
 *
 * Pattern reconocido (regex global):
 *   ```card:<type>\n<json>\n```
 *
 * Si el JSON no parsea, se trata como texto literal (graceful fallback).
 */

export interface ParsedCard {
  type: string;
  data: unknown;
  actions?: Array<{ id: string; label: string; primary?: boolean }>;
  pending?: boolean;
}

export type Segment =
  | { kind: "text"; content: string }
  | { kind: "card"; card: ParsedCard };

const CARD_PATTERN = /```card:([\w_-]+)\n([\s\S]+?)\n```/g;

export function parseCards(content: string): Segment[] {
  const segments: Segment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  CARD_PATTERN.lastIndex = 0;
  while ((match = CARD_PATTERN.exec(content)) !== null) {
    const [full, type, jsonStr] = match;
    const start = match.index;

    // Texto antes del card
    if (start > lastIndex) {
      const text = content.slice(lastIndex, start).trim();
      if (text) segments.push({ kind: "text", content: text });
    }

    // Parsear el card
    try {
      const parsed = JSON.parse(jsonStr);
      const data = parsed.data ?? parsed;
      const actions = parsed.actions;
      const pending = parsed.pending === true;
      segments.push({ kind: "card", card: { type, data, actions, pending } });
    } catch {
      // Fallback: si no parsea, lo dejamos como texto (visible al usuario, no crashea)
      segments.push({ kind: "text", content: full });
    }

    lastIndex = start + full.length;
  }

  // Texto residual al final
  if (lastIndex < content.length) {
    const text = content.slice(lastIndex).trim();
    if (text) segments.push({ kind: "text", content: text });
  }

  // Si no hubo cards, devolver todo como texto
  if (segments.length === 0 && content.trim()) {
    segments.push({ kind: "text", content });
  }

  return segments;
}
