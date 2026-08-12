import { Image as ImageIcon, ChevronDown, Check, Sparkles, Banana, Asterisk, Palette } from "lucide-react";
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
 */

interface EngineOption {
  engine: ImageEngine;
  label: string;
  shortLabel: string | null; // null = sin sufijo en el pill (caso Auto)
  description: string;
  icon: React.ReactNode;
}

const OPTIONS: EngineOption[] = [
  {
    engine: "auto",
    label: "Auto",
    shortLabel: null,
    description: "Cadena automática con respaldo",
    icon: <Sparkles className="size-4 text-white/70" />,
  },
  {
    engine: "gpt",
    label: "GPT Image 2",
    shortLabel: "GPT",
    description: "Mejor dirección de arte",
    icon: <Palette className="size-4 text-[var(--color-noa)]" />,
  },
  {
    engine: "nbp",
    label: "Nano Banana Pro",
    shortLabel: "NBP",
    description: "4K, fotorrealismo",
    icon: <Banana className="size-4 text-[var(--color-noa)]" />,
  },
  {
    engine: "grok",
    label: "Grok 2.0",
    shortLabel: "GROK",
    description: "Tipografía fuerte · más lento",
    icon: <Asterisk className="size-4 text-[var(--color-noa)]" />,
  },
];

interface ImageEnginePickerProps {
  engine: ImageEngine;
  onChange: (engine: ImageEngine) => void;
  className?: string;
}

export function ImageEnginePicker({ engine, onChange, className }: ImageEnginePickerProps) {
  const current = OPTIONS.find((o) => o.engine === engine) ?? OPTIONS[0];

  return (
    <Dropdown
      align="start"
      side="top"
      trigger={
        <button
          type="button"
          aria-label={`Motor de imagen: ${current.label}. Cambiar.`}
          data-no-focus-ring
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 rounded-full",
            "text-white/60 hover:text-white/90 hover:bg-white/[0.06] active:bg-white/[0.10]",
            "transition-colors duration-150",
            // 44px de alto real para el touch target (HIG) sin engordar el pill:
            // el borde visual lo da el rounded-full sobre el contenido.
            "min-h-[44px] outline-none border-0",
            className,
          )}
        >
          <ImageIcon className="size-4 shrink-0" />
          {current.shortLabel ? (
            <span
              className="mono text-[11px] tracking-tight uppercase leading-none font-semibold"
              style={{
                color: "var(--color-noa)",
                textShadow: "0 0 8px color-mix(in oklch, var(--color-noa) 55%, transparent)",
              }}
            >
              {current.shortLabel}
            </span>
          ) : (
            <span className="text-[12px] leading-none">Auto</span>
          )}
          <ChevronDown className="size-3.5 opacity-50" />
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
