import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Zap, Gauge, Brain, ChevronDown } from "lucide-react";
import type { ThinkingLevel } from "@/hooks/useChat";

/**
 * ThinkingLevelSelector — compact popover selector for Gemini 3.1 Pro
 * thinking depth. Only applies to Noa.
 *
 *   Fast      → low    — routing rápido, chitchat, preguntas simples
 *   Balanced  → medium — default, mayoría de tareas
 *   Deep      → high   — análisis profundo, Deep Think Mini
 */

interface Option {
  value: ThinkingLevel;
  label: string;
  desc: string;
  Icon: typeof Zap;
  color: string;
}

const OPTIONS: readonly Option[] = [
  { value: "low",    label: "Fast",     desc: "Quickest replies, simple routing", Icon: Zap,   color: "#D4E94B" },
  { value: "medium", label: "Balanced", desc: "Recommended for most tasks",       Icon: Gauge, color: "#FFFFFF" },
  { value: "high",   label: "Deep",     desc: "Deep Think — slower but thorough", Icon: Brain, color: "#00E5FF" },
] as const;

interface Props {
  value: ThinkingLevel;
  onChange: (level: ThinkingLevel) => void;
  disabled?: boolean;
}

export function ThinkingLevelSelector({ value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const active = OPTIONS.find((o) => o.value === value) ?? OPTIONS[1];
  const ActiveIcon = active.Icon;

  // Close on outside click / escape
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (navigator.vibrate) navigator.vibrate(6);
          setOpen((o) => !o);
        }}
        aria-label={`Thinking level: ${active.label}`}
        aria-expanded={open}
        className="flex items-center gap-1.5 h-8 px-2.5 rounded-full text-[12px] font-medium transition-colors disabled:opacity-40"
        style={{
          backgroundColor: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.12)",
          color: active.color,
        }}
      >
        <ActiveIcon className="w-3.5 h-3.5" strokeWidth={2.25} />
        <span className="leading-none">{active.label}</span>
        <ChevronDown
          className="w-3 h-3 transition-transform"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0)", color: "rgba(255,255,255,0.5)" }}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.96 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 top-[calc(100%+6px)] z-50 min-w-[220px] rounded-xl p-1 backdrop-blur-xl"
            style={{
              backgroundColor: "rgba(18,18,20,0.92)",
              border: "1px solid rgba(255,255,255,0.12)",
              boxShadow: "0 8px 32px -8px rgba(0,0,0,0.6)",
            }}
            role="menu"
          >
            {OPTIONS.map((opt) => {
              const OptIcon = opt.Icon;
              const isActive = value === opt.value;
              return (
                <button
                  key={opt.value}
                  role="menuitemradio"
                  aria-checked={isActive}
                  onClick={() => {
                    if (navigator.vibrate) navigator.vibrate(8);
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className="w-full flex items-start gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors hover:bg-white/5"
                  style={{
                    backgroundColor: isActive ? "rgba(255,255,255,0.06)" : "transparent",
                  }}
                >
                  <OptIcon
                    className="w-4 h-4 mt-0.5 shrink-0"
                    style={{ color: opt.color }}
                    strokeWidth={2.25}
                  />
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-[13px] font-medium leading-tight"
                      style={{ color: isActive ? opt.color : "rgba(255,255,255,0.92)" }}
                    >
                      {opt.label}
                    </div>
                    <div className="text-[10.5px] leading-tight mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>
                      {opt.desc}
                    </div>
                  </div>
                  {isActive && (
                    <div
                      className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                      style={{ backgroundColor: opt.color, boxShadow: `0 0 8px ${opt.color}` }}
                    />
                  )}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
