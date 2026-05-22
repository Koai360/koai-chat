import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface CopyBlockProps {
  text: string;
  label?: string;     // opcional: "Email", "WhatsApp", "Propuesta", etc.
  compact?: boolean;  // versión chiquita para snippets inline-block
}

/**
 * CopyBlock — bloque destacado con botón "Copiar" prominente.
 *
 * Render de la sintaxis ```copy ... ``` (o ```copy:Email ... ```).
 * Pensado para mensajes/emails/templates que el usuario va a pegar
 * directamente en otra plataforma.
 */
export function CopyBlock({ text, label, compact = false }: CopyBlockProps) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Fallback: textarea + execCommand
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      } catch {
        /* noop */
      }
      document.body.removeChild(ta);
    }
  };

  return (
    <div
      className="copy-block group relative"
      data-compact={compact || undefined}
    >
      <div className="copy-block-header">
        <span className="copy-block-label">{label || "Para copiar"}</span>
        <button
          type="button"
          onClick={onCopy}
          aria-label={copied ? "Copiado" : "Copiar texto"}
          className="copy-block-btn"
          data-copied={copied || undefined}
        >
          {copied ? (
            <>
              <Check className="size-3.5" />
              <span>Copiado</span>
            </>
          ) : (
            <>
              <Copy className="size-3.5" />
              <span>Copiar</span>
            </>
          )}
        </button>
      </div>
      <pre className="copy-block-body">{text}</pre>
    </div>
  );
}
