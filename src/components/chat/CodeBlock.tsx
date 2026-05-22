import { useState, type ReactNode } from "react";
import { Copy, Check } from "lucide-react";

interface CodeBlockProps {
  children: ReactNode;
  language?: string;
  raw: string;   // el texto crudo para el clipboard
}

/**
 * CodeBlock — wrapper de <pre><code> con mini-botón copiar visible al hover.
 * Para snippets técnicos (SQL, JSON, code, comandos). Si lo que querés es
 * un bloque destacado de texto para copiar/pegar (emails, mensajes), usa
 * el bloque ```copy en su lugar — se rendea como CopyBlock.
 */
export function CodeBlock({ children, language, raw }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(raw);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard denied, swallow */
    }
  };

  return (
    <div className="code-block group relative">
      {language && (
        <span className="code-block-lang" aria-hidden="true">
          {language}
        </span>
      )}
      <button
        type="button"
        onClick={onCopy}
        aria-label={copied ? "Copiado" : "Copiar código"}
        className="code-block-btn"
        data-copied={copied || undefined}
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      </button>
      <pre>{children}</pre>
    </div>
  );
}
