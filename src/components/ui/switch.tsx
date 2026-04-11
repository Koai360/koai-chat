import { useCallback } from "react";

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Toggle switch — track 44×24px con thumb 18px.
 * Touch target 44px mínimo (iOS HIG).
 */
export function Switch({ checked, onCheckedChange, disabled, className = "" }: SwitchProps) {
  const toggle = useCallback(() => {
    if (!disabled) onCheckedChange(!checked);
  }, [checked, disabled, onCheckedChange]);

  return (
    <button
      role="switch"
      type="button"
      aria-checked={checked}
      disabled={disabled}
      onClick={toggle}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kira/50 disabled:opacity-50 disabled:cursor-not-allowed ${
        checked ? "bg-kira" : "bg-white/10"
      } ${className}`}
    >
      <span
        className={`inline-block h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-transform duration-200 ${
          checked ? "translate-x-[22px]" : "translate-x-[3px]"
        }`}
      />
    </button>
  );
}
