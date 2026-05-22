import { DropdownMenu as DM } from "radix-ui";
import { type ReactNode } from "react";
import { cn } from "@/lib/cn";

interface DropdownProps {
  trigger: ReactNode;
  children: ReactNode;
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
}

export function Dropdown({ trigger, children, align = "end", side = "bottom" }: DropdownProps) {
  return (
    <DM.Root>
      <DM.Trigger asChild>{trigger}</DM.Trigger>
      <DM.Portal>
        <DM.Content
          align={align}
          side={side}
          sideOffset={8}
          className={cn(
            "z-50 min-w-[200px] p-1.5 rounded-xl",
            "bg-[var(--color-bg-overlay)] border border-[var(--color-border-hi)]",
            "shadow-[0_20px_60px_rgba(0,0,0,0.55)]",
            "backdrop-blur-xl",
          )}
        >
          {children}
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  );
}

interface DropdownItemProps {
  onClick?: () => void;
  children: ReactNode;
  icon?: ReactNode;
  variant?: "default" | "danger";
}

export function DropdownItem({ onClick, children, icon, variant = "default" }: DropdownItemProps) {
  return (
    <DM.Item
      onClick={onClick}
      className={cn(
        "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm cursor-pointer outline-none",
        "transition-colors duration-150",
        variant === "default" && "text-white/90 hover:bg-white/[0.06] focus:bg-white/[0.06]",
        variant === "danger" && "text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] focus:bg-[var(--color-danger-soft)]",
      )}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </DM.Item>
  );
}

export function DropdownSeparator() {
  return <DM.Separator className="my-1 h-px bg-white/[0.06]" />;
}
