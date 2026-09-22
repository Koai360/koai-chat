import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * InlineConfirm — confirmación EN EL LUGAR, sin `window.confirm`.
 *
 * S332 (critique de escritorio, Nielsen #4): borrar una conversación abría el popup blanco
 * del sistema sobre una UI oscura cuidada, mientras borrar una imagen ya usaba chips propios
 * en Galería. Misma acción, un solo patrón: la fila se convierte en la pregunta y dos botones.
 * Escape cancela; el foco arranca en "No" para que Enter por reflejo no destruya nada.
 */
export function InlineConfirm({
  question,
  confirmLabel = "Sí, borrar",
  cancelLabel = "No",
  onConfirm,
  onCancel,
  busy = false,
  className,
}: {
  question: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
  className?: string;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onCancel();
    }
  };

  return (
    <div
      role="group"
      aria-label={question}
      onKeyDown={onKey}
      className={cn(
        "flex items-center gap-2 min-w-0 rounded-lg px-2.5 py-1.5",
        "bg-[var(--color-danger-soft)] border border-[var(--color-danger)]/25",
        className,
      )}
    >
      <span className="flex-1 min-w-0 truncate text-[13px] text-white/90">{question}</span>
      <button
        ref={cancelRef}
        type="button"
        onClick={onCancel}
        disabled={busy}
        className="shrink-0 h-7 px-2.5 rounded-md text-[12px] font-medium text-white/80 bg-white/[0.06] hover:bg-white/[0.12] transition-colors disabled:opacity-50"
      >
        {cancelLabel}
      </button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={busy}
        className="shrink-0 h-7 px-2.5 rounded-md text-[12px] font-medium text-black bg-[var(--color-danger)] hover:brightness-110 transition disabled:opacity-50"
      >
        {busy ? "…" : confirmLabel}
      </button>
    </div>
  );
}

/**
 * InlineRename — renombrar EN LA FILA, sin `window.prompt`. Enter guarda, Escape cancela,
 * blur guarda si cambió (el usuario ya escribió; perderlo por un click afuera es peor).
 */
export function InlineRename({
  value,
  onSubmit,
  onCancel,
  placeholder = "Nombre del chat",
  className,
}: {
  value: string;
  onSubmit: (next: string) => void;
  onCancel: () => void;
  placeholder?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  const commit = () => {
    const next = draft.trim();
    if (!next || next === value.trim()) {
      onCancel();
      return;
    }
    onSubmit(next);
  };

  return (
    <div className={cn("flex items-center gap-1.5 min-w-0", className)}>
      <input
        ref={ref}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            e.stopPropagation();
            onCancel();
          }
        }}
        placeholder={placeholder}
        aria-label="Nuevo nombre del chat"
        className="flex-1 min-w-0 h-8 px-2.5 rounded-md bg-[var(--color-bg-input)] border border-[var(--color-noa)]/40 text-[13px] text-white outline-none"
      />
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={commit}
        aria-label="Guardar nombre"
        className="shrink-0 size-8 rounded-md flex items-center justify-center text-[var(--color-noa)] hover:bg-[var(--color-noa-soft)] transition-colors"
      >
        <Check className="size-4" />
      </button>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onCancel}
        aria-label="Cancelar"
        className="shrink-0 size-8 rounded-md flex items-center justify-center text-white/55 hover:bg-white/[0.08] hover:text-white transition-colors"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
