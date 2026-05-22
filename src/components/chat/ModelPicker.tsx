import { Brain, ChevronDown, Check } from "lucide-react";
import { Dropdown, DropdownItem, DropdownSeparator } from "@/components/ui/Dropdown";
import { cn } from "@/lib/cn";
import type { ModelMode } from "@/lib/autoThinking";
import noaIcon from "@/assets/noa-icon.png";

/**
 * ModelPicker — selector visible arriba del chat.
 *
 * 2 modos explícitos (sin Auto):
 *   - Estándar (default) → Gemini 3.5 Flash, instant para el día a día
 *   - Pro                → Gemini 3.5 Pro thinking=high, análisis profundo
 *
 * Visual TopBar:
 *   - Estándar:       "Noa ⌄"                  (limpio, sin sufijo)
 *   - Pro:            "Noa · Pro ⌄"            ("Pro" en verde neon)
 */

interface ModeOption {
  mode: ModelMode;
  label: string;
  shortLabel: string | null;     // null = no se muestra sufijo en el pill (caso Estándar)
  description: string;
  icon: React.ReactNode;
}

const OPTIONS: ModeOption[] = [
  {
    mode: "standard",
    label: "Estándar",
    shortLabel: null,
    description: "Rápido para el día a día",
    icon: <img src={noaIcon} alt="" aria-hidden="true" className="size-4 object-contain opacity-90" />,
  },
  {
    mode: "pro",
    label: "Pro",
    shortLabel: "Pro",
    description: "Análisis profundos",
    icon: <Brain className="size-4 text-[var(--color-noa)]" />,
  },
];

interface ModelPickerProps {
  mode: ModelMode;
  onChange: (mode: ModelMode) => void;
  className?: string;
}

export function ModelPicker({ mode, onChange, className }: ModelPickerProps) {
  const current = OPTIONS.find((o) => o.mode === mode) ?? OPTIONS[0];

  return (
    <Dropdown
      align="center"
      side="bottom"
      trigger={
        <button
          aria-label={`Modo: ${current.label}. Cambiar.`}
          data-no-focus-ring
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full",
            "text-white hover:bg-white/[0.06] active:bg-white/[0.10]",
            "transition-colors duration-150",
            "min-h-[36px] outline-none border-0",
            className,
          )}
        >
          <span className="display text-[16px] font-semibold leading-none">Noa</span>
          {current.shortLabel && (
            <>
              <span className="text-white/30 leading-none">·</span>
              <span
                className="mono text-[11px] tracking-tight uppercase leading-none font-semibold"
                style={{
                  color: "var(--color-noa)",
                  textShadow: "0 0 8px color-mix(in oklch, var(--color-noa) 55%, transparent)",
                }}
              >
                {current.shortLabel}
              </span>
            </>
          )}
          <ChevronDown className="size-3.5 text-white/40" />
        </button>
      }
    >
      <div className="px-3 py-2 mb-1">
        <p className="mono text-[10px] uppercase tracking-[0.12em] text-white/45 font-medium">
          Modo
        </p>
      </div>
      <DropdownSeparator />
      {OPTIONS.map((opt) => {
        const active = opt.mode === mode;
        return (
          <DropdownItem key={opt.mode} icon={opt.icon} onClick={() => onChange(opt.mode)}>
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
