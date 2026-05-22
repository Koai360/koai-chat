import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

interface PillProps extends HTMLAttributes<HTMLDivElement> {
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  tone?: "neutral" | "noa" | "warning" | "danger";
  size?: "sm" | "md";
}

const TONES: Record<NonNullable<PillProps["tone"]>, string> = {
  neutral: "bg-white/[0.06] text-white/80 border border-white/[0.08]",
  noa: "bg-[var(--color-noa-soft)] text-[var(--color-noa)] border border-[var(--color-noa)]/30",
  warning: "bg-[var(--color-warning-soft)] text-[var(--color-warning)] border border-[var(--color-warning)]/30",
  danger: "bg-[var(--color-danger-soft)] text-[var(--color-danger)] border border-[var(--color-danger)]/30",
};

export const Pill = forwardRef<HTMLDivElement, PillProps>(
  ({ leadingIcon, trailingIcon, tone = "neutral", size = "sm", className, children, ...rest }, ref) => {
    const sizeCls = size === "sm" ? "h-6 px-2.5 text-xs gap-1" : "h-8 px-3 text-sm gap-1.5";
    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-full font-medium select-none",
          sizeCls,
          TONES[tone],
          className,
        )}
        {...rest}
      >
        {leadingIcon}
        {children}
        {trailingIcon}
      </div>
    );
  },
);
Pill.displayName = "Pill";
