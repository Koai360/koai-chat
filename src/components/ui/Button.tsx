import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  loading?: boolean;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--color-noa)] text-black hover:brightness-110 active:brightness-95 shadow-[0_0_24px_var(--color-noa-glow)]",
  secondary:
    "bg-[var(--color-bg-elevated)] text-white border border-[var(--color-border-hi)] hover:bg-[var(--color-bg-overlay)] hover:border-[var(--color-border-strong)]",
  ghost:
    "bg-transparent text-white/80 hover:bg-white/[0.04] hover:text-white",
  danger:
    "bg-[var(--color-danger-soft)] text-[var(--color-danger)] border border-[var(--color-danger)]/30 hover:bg-[var(--color-danger)]/20",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm gap-1.5 rounded-[10px]",
  md: "h-11 px-4 text-sm gap-2 rounded-[12px]",
  lg: "h-12 px-6 text-base gap-2 rounded-[12px]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "secondary",
      size = "md",
      leadingIcon,
      trailingIcon,
      loading,
      className,
      children,
      disabled,
      ...rest
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center font-medium select-none",
          "transition-all duration-200 ease-out",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "focus-visible:outline-none",
          VARIANTS[variant],
          SIZES[size],
          className,
        )}
        {...rest}
      >
        {loading ? (
          <span className="size-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
        ) : (
          leadingIcon
        )}
        {children}
        {!loading && trailingIcon}
      </button>
    );
  },
);
Button.displayName = "Button";
