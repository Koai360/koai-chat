/**
 * markdownPreprocess — transforma sintaxis custom de Noa antes de
 * pasarla a ReactMarkdown.
 *
 * Sintaxis soportada:
 *   ==texto==              → <mark class="hl">texto</mark>
 *   :lime[texto]           → <span class="hl-lime">texto</span>
 *   :red[texto]            → <span class="hl-red">texto</span>
 *   :green[texto]          → <span class="hl-green">texto</span>
 *   :yellow[texto]         → <span class="hl-yellow">texto</span>
 *   :purple[texto]         → <span class="hl-purple">texto</span>
 *
 *   > [!INFO] / [!TIP] / [!WARN] / [!SUCCESS] / [!DANGER]
 *   > contenido del callout
 *   > sigue aquí
 *
 * Se transforma a HTML inline que `rehype-raw` parsea y los
 * components custom del ReactMarkdown renderean.
 *
 * Importante: el contenido viene del LLM (Noa), no del usuario. Las
 * burbujas user usan ReactMarkdown SIN rehype-raw — no hay vector XSS
 * desde input externo.
 */

const COLOR_INLINE = /:(lime|red|green|yellow|purple)\[([^\]]+)\]/g;
const HIGHLIGHT = /==([^=]+)==/g;
const ALERT_BLOCK = /^>\s*\[!(INFO|TIP|WARN|WARNING|SUCCESS|DANGER|CAUTION|NOTE|IMPORTANT)\]\s*(.*)$([\s\S]*?)(?=\n\s*\n|\n[^>]|$)/gim;

const ALERT_TYPE_MAP: Record<string, string> = {
  INFO: "info",
  NOTE: "info",
  TIP: "tip",
  WARN: "warn",
  WARNING: "warn",
  CAUTION: "warn",
  SUCCESS: "success",
  IMPORTANT: "danger",
  DANGER: "danger",
};

function escapeInlineHtml(s: string): string {
  // Solo escapamos el bare minimum — el resto sigue siendo markdown.
  return s.replace(/[<>]/g, (c) => (c === "<" ? "&lt;" : "&gt;"));
}

export function preprocessMarkdown(input: string): string {
  if (!input) return input;
  let out = input;

  // 1) Highlights inline ==text==
  out = out.replace(HIGHLIGHT, (_, txt) => `<mark class="hl">${escapeInlineHtml(txt)}</mark>`);

  // 2) Color inline :lime[texto], etc.
  out = out.replace(COLOR_INLINE, (_, color, txt) => {
    return `<span class="hl-${color}">${escapeInlineHtml(txt)}</span>`;
  });

  // 3) Callout blocks: > [!TYPE] header? \n > body lines
  //    Convertir todo el blockquote a <div class="callout callout-{type}">...</div>
  out = out.replace(ALERT_BLOCK, (match, rawType, headerText) => {
    const type = ALERT_TYPE_MAP[rawType.toUpperCase()] ?? "info";
    // Extraer body: las líneas siguientes que empiezan con `> `
    const lines = match.split("\n");
    const bodyLines: string[] = [];
    if (headerText && headerText.trim()) bodyLines.push(headerText.trim());
    for (let i = 1; i < lines.length; i++) {
      const m = lines[i].match(/^>\s?(.*)$/);
      if (m) bodyLines.push(m[1]);
      else break;
    }
    const body = bodyLines.join(" ").trim();
    return `<div class="callout callout-${type}">${escapeInlineHtml(body)}</div>`;
  });

  return out;
}
