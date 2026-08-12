import { Check, Sparkles, Banana, Asterisk, Palette } from "lucide-react";
import { Dropdown, DropdownItem, DropdownSeparator } from "@/components/ui/Dropdown";
import { cn } from "@/lib/cn";
import type { ImageEngine } from "@/lib/imageEngine";

/**
 * ImageEnginePicker — elige con qué motor genera Noa las imágenes (S228).
 *
 * Auto (default) mantiene la cadena del backend: GPT Image 2 → Nano Banana Pro
 * → NB2 Flash → Imagen 4. Los otros tres son motor ÚNICO: si fallan devuelven
 * error en vez de caer a otro, que es justamente el punto de elegirlo.
 *
 * Solo afecta a la GENERACIÓN. La edición sigue siempre en Flux.2 pro, que es
 * el único que preserva el arte aprobado pixel-perfect.
 *
 * 🔴 SOLO ICONO, 40x40 — igual que los IconButton size="md" vecinos.
 * La v1 era un pill con texto ("🖼 NBP ⌄") y 44px de alto: en 390px se comía
 * ~25% del ancho del campo y sobresalía 4px sobre + y el escudo. Doble
 * desalineación — "quedaba atravesado". El motor activo se comunica por su
 * icono propio + tinte lima; el NOMBRE vive en el aria-label y en el menú,
 * nunca en hover (no existe en touch).
 */

interface EngineOption {
  engine: ImageEngine;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const OPTIONS: EngineOption[] = [
  {
    engine: "auto",
    label: "Auto",
    description: "Cadena automática con respaldo",
    icon: <Sparkles className="size-4 text-white/70" />,
  },
  {
    engine: "gpt",
    label: "GPT Image 2",
    description: "Mejor dirección de arte",
    icon: <Palette className="size-4 text-[var(--color-noa)]" />,
  },
  {
    engine: "nbp",
    label: "Nano Banana Pro",
    description: "4K, fotorrealismo",
    icon: <Banana className="size-4 text-[var(--color-noa)]" />,
  },
  {
    engine: "grok",
    label: "Grok 2.0",
    description: "Tipografía fuerte · más lento",
    icon: <Asterisk className="size-4 text-[var(--color-noa)]" />,
  },
];

/** Icono del trigger: el del motor activo, al tamaño de los IconButton vecinos. */
const TRIGGER_ICON: Record<ImageEngine, React.ReactNode> = {
  auto: <Sparkles className="size-[18px]" />,
  gpt: <Palette className="size-[18px]" />,
  nbp: <Banana className="size-[18px]" />,
  grok: <Asterisk className="size-[18px]" strokeWidth={2.4} />,
};

interface ImageEnginePickerProps {
  engine: ImageEngine;
  onChange: (engine: ImageEngine) => void;
  className?: string;
}

export function ImageEnginePicker({ engine, onChange, className }: ImageEnginePickerProps) {
  const current = OPTIONS.find((o) => o.engine === engine) ?? OPTIONS[0];
  // Auto no es "una elección" visualmente: es el estado de reposo del chat.
  const activo = engine !== "auto";

  return (
    <Dropdown
      align="start"
      side="top"
      trigger={
        <button
          type="button"
          aria-label={`Motor de imagen: ${current.label}. Cambiar.`}
          title={`Motor de imagen: ${current.label}`}
          data-no-focus-ring
          className={cn(
            // size-10 = 40x40, EXACTAMENTE lo que mide IconButton size="md".
            // El chat tiene excepción documentada al mínimo de 44px: mantener
            // los 40 de la fila vale más que ganar 4px sueltos en un botón.
            "inline-flex items-center justify-center rounded-full size-10 shrink-0",
            "transition-all duration-200 ease-out outline-none border-0",
            // Auto = apagado como sus vecinos. Motor elegido = lima + fondo
            // tenue, el mismo tratamiento que `active` en IconButton.
            activo
              ? "bg-white/[0.08] text-[var(--color-noa)]"
              : "bg-transparent text-white/70 hover:bg-white/[0.06] hover:text-white",
            "active:bg-white/[0.12]",
            className,
          )}
        >
          {TRIGGER_ICON[engine]}
        </button>
      }
    >
      <div className="px-3 py-2 mb-1">
        <p className="mono text-[10px] uppercase tracking-[0.12em] text-white/45 font-medium">
          Motor de imagen
        </p>
      </div>
      <DropdownSeparator />
      {OPTIONS.map((opt) => {
        const active = opt.engine === engine;
        return (
          <DropdownItem key={opt.engine} icon={opt.icon} onClick={() => onChange(opt.engine)}>
            <div className="flex-1 flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[14px] text-white/95 font-medium leading-tight">{opt.label}</p>
                <p className="text-[12px] text-white/50 leading-tight mt-0.5">{opt.description}</p>
              </div>
              {active && <Check className="size-4 text-[var(--color-noa)] shrink-0 mt-0.5" />}
            </div>
          </DropdownItem>
        );
      })}
    </Dropdown>
  );
}
