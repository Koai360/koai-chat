import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";

/**
 * EngineSelector — visual model picker for image generation.
 *
 * Replaces the legacy dropdown with horizontally-scrollable cards (mobile)
 * or a flex grid (desktop). Each card shows:
 *   - the engine "mark" (large initial in Sora bold, color-coded by tier)
 *   - the engine label (Sora medium)
 *   - cost + time as mono micro-labels (JetBrains Mono)
 *   - a check pill when active
 *
 * Active card uses .liquid-glass-strong with stronger border + subtle glow.
 * Inactive cards are quiet, hover lifts them slightly.
 *
 * Design intent: feels like a liquid-glass tool palette from Apple Vision OS,
 * not a SaaS dropdown. No icon clichés (no zap, sparkles, crown — those are AI
 * slop fingerprints). The "mark" letter is the visual identifier.
 */

export type EngineValue =
  | "gemini"
  | "zimage"
  | "flux2"
  | "flux"
  | "studioflux-raw";

export interface EngineOption {
  value: EngineValue;
  label: string;
  /** Human-readable price + speed hint */
  desc: string;
  /** Tier defines color treatment of the mark */
  tier: "free" | "value" | "premium" | "premium-paid" | "advanced";
  /** Single uppercase letter rendered large as the visual identifier */
  mark: string;
}

export const ENGINE_OPTIONS: readonly EngineOption[] = [
  { value: "gemini", label: "Rápida", desc: "Gemini · gratis · ~3s", tier: "free", mark: "G" },
  { value: "zimage", label: "Z-Image", desc: "Turbo · $0.016 · ~5s", tier: "value", mark: "Z" },
  { value: "flux2", label: "Flux.2 Pro", desc: "32B · $0.035 · ~30s", tier: "premium", mark: "F" },
  { value: "flux", label: "Flux Hosted", desc: "BFL API · $0.07 · ~8s", tier: "premium-paid", mark: "B" },
  { value: "studioflux-raw", label: "RAW", desc: "Sin enhancer · directo", tier: "advanced", mark: "R" },
] as const;

interface Props {
  value: EngineValue;
  onChange: (value: EngineValue) => void;
}

/** Color treatment per tier — uses existing KOAI tokens, no new hardcoded colors */
const TIER_COLOR: Record<EngineOption["tier"], { mark: string; glow: string; bg: string }> = {
  free:          { mark: "rgba(255,255,255,0.85)", glow: "rgba(255,255,255,0.18)",  bg: "rgba(255,255,255,0.04)"  },
  value:         { mark: "#D4E94B",                glow: "rgba(212,233,75,0.35)",   bg: "rgba(212,233,75,0.06)"   },
  premium:       { mark: "#7B2D8E",                glow: "rgba(123,45,142,0.40)",   bg: "rgba(123,45,142,0.08)"   },
  "premium-paid":{ mark: "#00E5FF",                glow: "rgba(0,229,255,0.30)",    bg: "rgba(0,229,255,0.06)"    },
  advanced:      { mark: "rgba(255,255,255,0.55)", glow: "rgba(255,255,255,0.10)",  bg: "rgba(255,255,255,0.03)"  },
};

export function EngineSelector({ value, onChange }: Props) {
  return (
    <div className="w-full">
      {/* Section label — small, mono, no icon — Linear-style */}
      <div className="px-1 mb-2 flex items-baseline justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-subtle">
          Motor
        </span>
        <span className="font-mono text-[9px] tracking-tight text-text-subtle">
          {ENGINE_OPTIONS.length} disponibles
        </span>
      </div>

      {/* Cards: horizontally scrollable on mobile, wrap-grid on desktop */}
      <div
        role="radiogroup"
        aria-label="Motor de generación de imagen"
        className="
          flex gap-2 overflow-x-auto no-scrollbar pb-1
          md:grid md:grid-cols-5 md:overflow-visible md:pb-0
        "
      >
        {ENGINE_OPTIONS.map((opt, i) => {
          const active = value === opt.value;
          const colors = TIER_COLOR[opt.tier];
          return (
            <motion.button
              key={opt.value}
              role="radio"
              aria-checked={active}
              aria-label={`${opt.label} — ${opt.desc}`}
              onClick={() => {
                if (navigator.vibrate) navigator.vibrate(8);
                onChange(opt.value);
              }}
              initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{
                duration: 0.35,
                delay: 0.04 * i,
                ease: [0.16, 1, 0.3, 1],
              }}
              whileTap={{ scale: 0.97 }}
              className={`
                relative shrink-0 md:shrink
                min-w-[112px] md:min-w-0
                rounded-2xl
                px-3 py-2.5
                text-left
                transition-[border-color,box-shadow,background] duration-300
                ${active ? "liquid-glass-strong" : "liquid-glass"}
              `}
              style={{
                // Active card gets a tier-colored glow + tinted background
                ...(active && {
                  boxShadow: `
                    0 0 0 1px ${colors.glow},
                    0 8px 32px -8px ${colors.glow},
                    inset 0 1px 1px rgba(255,255,255,0.18)
                  `,
                  background: `linear-gradient(180deg, ${colors.bg}, transparent 80%)`,
                }),
              }}
            >
              {/* Top row: mark + check */}
              <div className="flex items-start justify-between mb-1.5">
                <span
                  className="font-display font-bold leading-none select-none"
                  style={{
                    fontSize: "26px",
                    color: colors.mark,
                    letterSpacing: "-0.04em",
                    textShadow: active ? `0 0 18px ${colors.glow}` : "none",
                    transition: "text-shadow 0.3s ease",
                  }}
                >
                  {opt.mark}
                </span>

                <AnimatePresence>
                  {active && (
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: [0.34, 1.56, 0.64, 1] }}
                      className="w-4 h-4 rounded-full flex items-center justify-center"
                      style={{ background: colors.mark }}
                    >
                      <Check
                        className="h-2.5 w-2.5"
                        strokeWidth={3.5}
                        style={{ color: opt.tier === "free" || opt.tier === "advanced" ? "#0a0a0c" : "#0a0a0c" }}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Label — Sora medium */}
              <div
                className="font-display text-[12.5px] font-medium leading-tight text-text"
                style={{ letterSpacing: "-0.01em" }}
              >
                {opt.label}
              </div>

              {/* Cost + speed — mono micro-label, color-tinted when active */}
              <div
                className="font-mono text-[9.5px] leading-snug mt-1 truncate"
                style={{
                  color: active ? colors.mark : "rgba(255,255,255,0.42)",
                  opacity: active ? 0.95 : 1,
                  transition: "color 0.3s ease",
                }}
                title={opt.desc}
              >
                {opt.desc}
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
