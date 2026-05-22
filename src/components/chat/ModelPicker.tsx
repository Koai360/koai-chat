import { Zap, Sparkles, Brain, ChevronDown, Check } from "lucide-react";
import { Dropdown, DropdownItem, DropdownSeparator } from "@/components/ui/Dropdown";
import { cn } from "@/lib/cn";
import type { ThinkingLevel } from "@/types/api";

/**
 * ModelPicker — selector visible "Noa <variant>" arriba del chat.
 *
 * Las 3 variantes mapean al thinking_level del backend (Gemini 3.5 Flash):
 *   - Flash      → low      (rápido, ideal para respuestas cortas)
 *   - Balanced   → medium   (default, balance speed/quality)
 *   - Pro        → high     (deep thinking, mejor para análisis)
 *
 * Visualmente compact en TopBar: "Noa · 3.5 Flash ⌄" → click abre dropdown.
 */

interface ModelOption {
  level: ThinkingLevel;
  label: string;
  shortLabel: string;
  description: string;
  icon: React.ReactNode;
}

const OPTIONS: ModelOption[] = [
  {
    level: "low",
    label: "Noa Flash",
    shortLabel: "3.5 Flash",
    description: "Rápida · Respuestas cortas",
    icon: <Zap className="size-4 text-[var(--color-noa)]" />,
  },
  {
    level: "medium",
    label: "Noa Balanced",
    shortLabel: "3.5 Balanced",
    description: "Balanceada · Default",
    icon: <Sparkles className="size-4 text-white/80" />,
  },
  {
    level: "high",
    label: "Noa Pro",
    shortLabel: "3.5 Pro",
    description: "Profunda · Análisis complejos",
    icon: <Brain className="size-4 text-[var(--color-purple)]" />,
  },
];

interface ModelPickerProps {
  level: ThinkingLevel;
  onChange: (level: ThinkingLevel) => void;
  className?: string;
}

export function ModelPicker({ level, onChange, className }: ModelPickerProps) {
  const current = OPTIONS.find((o) => o.level === level) ?? OPTIONS[1];

  return (
    <Dropdown
      align="center"
      side="bottom"
      trigger={
        <button
          aria-label={`Modelo: ${current.label}. Cambiar variante`}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full",
            "text-white hover:bg-white/[0.06] active:bg-white/[0.10]",
            "transition-colors duration-150",
            "min-h-[36px]",
            // Solo mostrar focus ring por keyboard nav (NO por touch/click)
            "focus:outline-none focus:ring-0 focus-visible:ring-2 focus-visible:ring-[var(--color-noa)]/40",
            className,
          )}
        >
          <span className="display text-[16px] font-semibold leading-none">Noa</span>
          <span className="mono text-[11px] text-white/45 tracking-tight uppercase leading-none">
            {current.shortLabel}
          </span>
          <ChevronDown className="size-3.5 text-white/40" />
        </button>
      }
    >
      <div className="px-3 py-2 mb-1">
        <p className="mono text-[10px] uppercase tracking-[0.12em] text-white/45 font-medium">
          Modelo
        </p>
      </div>
      <DropdownSeparator />
      {OPTIONS.map((opt) => {
        const active = opt.level === level;
        return (
          <DropdownItem
            key={opt.level}
            icon={opt.icon}
            onClick={() => onChange(opt.level)}
          >
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
