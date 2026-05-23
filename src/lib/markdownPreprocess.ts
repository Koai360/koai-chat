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

// Convierte markdown inline (bold/italic/code) a HTML.
// Usado dentro del body de callouts donde ReactMarkdown ya no re-procesa
// el contenido (porque está embebido en <div>).
function applyInlineMarkdown(s: string): string {
  return s
    // Bold ** primero para que single * no agarre el caso ** primero
    .replace(/\*\*([^*\n]+?)\*\*/g, "<strong>$1</strong>")
    // Italic *text* o _text_ (negative lookahead/lookbehind evita conflictos con **)
    .replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, "<em>$1</em>")
    .replace(/(?<!_)_([^_\n]+?)_(?!_)/g, "<em>$1</em>")
    // Code inline
    .replace(/`([^`\n]+?)`/g, "<code>$1</code>");
}

export function preprocessMarkdown(input: string): string {
  if (!input) return input;
  let out = input;

  // ─── Stash de HTML legítimo ──────────────────────────────────────────
  // Cuando un highlight/color cae DENTRO de un callout, el body del callout
  // recibe el HTML ya inyectado (<span class="hl-*">). Si después escapamos
  // ese body, los `<>` del HTML se convierten en `&lt;`/`&gt;` y el browser
  // los muestra literal en pantalla (bug visto 2026-05-23: "<span class=hl-yellow>9 días</span>").
  //
  // Solución: stash de HTML legítimo con placeholder durante el preprocess,
  // restaurarlo al final. El escape del paso 3 opera sobre placeholders
  // (sin `<>`), no sobre el HTML real.
  const safeBlocks: string[] = [];
  // Delimitadores en Private Use Area Unicode (U+E000 / U+E001) — jamás aparecen
  // en texto natural y applyInlineMarkdown NO los procesa (no son _, *, ` ni ==).
  // El prefix anterior "SAFE_HTML_" tenía underscores que applyInlineMarkdown
  // convertía en <em>...</em>, rompiendo la restauración (bug 2026-05-23).
  const STASH_PREFIX = "\uE000";
  const STASH_SUFFIX = "\uE001";
  const STASH_RE = /\uE000(\d+)\uE001/g;

  function stash(html: string): string {
    const idx = safeBlocks.length;
    safeBlocks.push(html);
    return `${STASH_PREFIX}${idx}${STASH_SUFFIX}`;
  }

  // 1) Highlights inline ==text==
  out = out.replace(HIGHLIGHT, (_, txt) =>
    stash(`<mark class="hl">${escapeInlineHtml(txt)}</mark>`),
  );

  // 2) Color inline :lime[texto], etc.
  out = out.replace(COLOR_INLINE, (_, color, txt) =>
    stash(`<span class="hl-${color}">${escapeInlineHtml(txt)}</span>`),
  );

  // 3) Callout blocks: > [!TYPE] header? \n > body lines
  out = out.replace(ALERT_BLOCK, (match, rawType, headerText) => {
    const type = ALERT_TYPE_MAP[rawType.toUpperCase()] ?? "info";
    const lines = match.split("\n");
    const bodyLines: string[] = [];
    if (headerText && headerText.trim()) bodyLines.push(headerText.trim());
    for (let i = 1; i < lines.length; i++) {
      const m = lines[i].match(/^>\s?(.*)$/);
      if (m) bodyLines.push(m[1]);
      else break;
    }
    const body = bodyLines.join(" ").trim();
    // Body puede contener:
    //   - Placeholders ${STASH_PREFIX}N${STASH_SUFFIX} de highlights/colors (HTML stashed)
    //   - Texto raw del LLM con potenciales `<` `>` peligrosos (XSS)
    //   - Markdown inline (**bold**, *italic*, `code`)
    //
    // Estrategia: escapar `<>` del body (mata XSS sin tocar placeholders porque
    // los placeholders usan , no `<>`). Luego applyInlineMarkdown convierte
    // **bold** etc. a HTML válido. Después stash todo el div con su contenido ya
    // procesado para que el escape del NEXT match no lo toque.
    const safe = applyInlineMarkdown(escapeInlineHtml(body));
    return stash(`<div class="callout callout-${type}">${safe}</div>`);
  });

  // Restaurar placeholders → HTML legítimo. Iterar porque los placeholders
  // pueden estar ANIDADOS (un stash dentro del body de un callout también
  // contiene placeholders de highlights/colors stasheados previamente).
  // Single-pass solo restaura el outer; iteramos hasta convergencia.
  let prev = "";
  let iterations = 0;
  while (prev !== out && iterations < 10) {
    prev = out;
    out = out.replace(STASH_RE, (_, idx) => safeBlocks[parseInt(idx, 10)] ?? "");
    iterations++;
  }

  return out;
}
