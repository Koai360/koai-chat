import { memo, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import { CopyBlock } from "./CopyBlock";
import { CodeBlock } from "./CodeBlock";
import { cfImageVariant } from "@/lib/imageTransform";
import { preprocessMarkdown } from "@/lib/markdownPreprocess";
import { noaSanitizeSchema } from "@/lib/markdownSanitizeSchema";
import { noaHighlightLanguages } from "@/lib/highlightLanguages";

interface NoaMarkdownProps {
  content: string;
  /**
   * Si true, NO procesar callouts/highlights ni custom code blocks.
   * Útil para mensajes user (texto plano básico, sin sintaxis custom).
   */
  plain?: boolean;
}

/**
 * Extrae texto crudo de los children de ReactMarkdown (que puede traer arrays anidados).
 */
function extractText(node: ReactNode): string {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (typeof node === "object" && "props" in (node as object)) {
    // @ts-expect-error narrowed via props guard
    return extractText(node.props.children);
  }
  return "";
}

/**
 * NoaMarkdown — single source of truth para renderizar markdown del asistente.
 *
 * P0-1 audit: rehype-sanitize aplicado entre raw y highlight (XSS hardening).
 * P1-8 audit: highlight.js subset de 11 lenguajes (no `common` set entero).
 * P2-2 audit: misma renderización en streaming y en final (no flash visible al
 *             promover el mensaje). Antes MessageStream usaba SOLO rehypeHighlight
 *             (sin raw, sin sanitize, sin preprocess, sin CopyBlock/CodeBlock).
 */
export const NoaMarkdown = memo(function NoaMarkdown({
  content,
  plain = false,
}: NoaMarkdownProps) {
  if (plain) {
    // Path para burbujas user (sin rehype-raw, sin preprocess, plain text + basic md).
    // S158-b: remark-gfm también acá para que saltos de línea/listas del user
    // no se rendericen pegados.
    return <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>;
  }

  return (
    <ReactMarkdown
      // S158-b: remark-gfm — sin esto las TABLAS markdown nunca renderizaban
      // (crítico: Noa responde datos financieros tabulares). El CSS de tablas
      // en globals.css era código muerto hasta hoy.
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[
        rehypeRaw as never,
        [rehypeSanitize, noaSanitizeSchema] as never,
        [rehypeHighlight, { languages: noaHighlightLanguages, detect: true }] as never,
      ]}
      components={{
        // Override `<pre>` para soportar:
        //   ```copy[:Label] ... ```  → CopyBlock destacado
        //   ```lang ... ```          → CodeBlock con mini-botón copiar
        pre({ children }) {
          const codeNode = Array.isArray(children) ? children[0] : children;
          const className =
            (codeNode as { props?: { className?: string } })?.props?.className ?? "";
          const langMatch = /language-([\w:-]+)/.exec(className);
          const lang = langMatch ? langMatch[1] : "";
          const rawText = extractText(
            (codeNode as { props?: { children?: ReactNode } })?.props?.children,
          ).replace(/\n$/, "");

          if (lang.startsWith("copy")) {
            const label = lang.includes(":") ? lang.split(":")[1] : undefined;
            return <CopyBlock text={rawText} label={label} />;
          }
          return (
            <CodeBlock language={lang || undefined} raw={rawText}>
              {children}
            </CodeBlock>
          );
        },
        // S164: imágenes markdown del modelo — antes renderizaban el PNG
        // original multi-MB sin constraint (overflow + data). Variante CF
        // 960px para cdn.koai360.com + estilos acotados.
        // S164-b: el modelo a veces INVENTA la URL (ej. sufijo "_edited" que
        // no existe → 404) → quedaba una imagen rota "que no carga" en la
        // burbuja mientras la real vive en message.image. onError la oculta.
        img({ src, alt }) {
          const url = typeof src === "string" ? src : "";
          if (!url) return null;
          const display = url.includes("cdn.koai360.com")
            ? cfImageVariant(url, 960)
            : url;
          return (
            <img
              src={display}
              alt={alt || ""}
              loading="lazy"
              decoding="async"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
              className="block w-full max-w-[480px] h-auto rounded-xl border border-white/[0.06] my-2"
            />
          );
        },
      }}
    >
      {preprocessMarkdown(content)}
    </ReactMarkdown>
  );
});
