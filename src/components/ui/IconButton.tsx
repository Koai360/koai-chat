import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export type IconButtonSize = "sm" | "md" | "lg";
export type IconButtonVariant = "ghost" | "filled" | "primary";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  size?: IconButtonSize;
  variant?: IconButtonVariant;
  label: string; // a11y obligatorio
  active?: boolean;
}

const SIZES: Record<IconButtonSize, string> = {
  sm: "size-8",
  md: "size-10",
  lg: "size-11",
};

const VARIANTS: Record<IconButtonVariant, string> = {
  ghost: "bg-transparent text-white/70 hover:bg-white/[0.06] hover:text-white",
  filled: "bg-[var(--color-bg-elevated)] text-white/80 hover:bg-[var(--color-bg-overlay)] hover:text-white border border-[var(--color-border)]",
  primary: "bg-[var(--color-noa)] text-black hover:brightness-110",
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, size = "md", variant = "ghost", active = false, label, className, ...rest }, ref) => {
    return (
      <button
        ref={ref}
        aria-label={label}
        title={label}
        className={cn(
          "inline-flex items-center justify-center rounded-full",
          "transition-all duration-200 ease-out",
          "disabled:opacity-40 disabled:cursor-not-allowed",
          "focus-visible:outline-none",
          SIZES[size],
          VARIANTS[variant],
          active && "bg-white/[0.08] text-white",
          className,
        )}
        {...rest}
      >
        {icon}
      </button>
    );
  },
);
IconButton.displayName = "IconButton";
