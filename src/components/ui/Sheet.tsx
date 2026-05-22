import { Drawer } from "vaul";
import { type ReactNode } from "react";
import { cn } from "@/lib/cn";

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side?: "left" | "right" | "bottom";
  children: ReactNode;
  className?: string;
}

/**
 * Sheet — drawer mobile (vaul).
 *
 * Side: "left" para sidebar, "right" para panels, "bottom" para voice modal /
 * action sheets. Backdrop oscuro + blur sutil.
 */
export function Sheet({ open, onOpenChange, side = "left", children, className }: SheetProps) {
  const direction = side === "left" ? "left" : side === "right" ? "right" : "bottom";
  const positionCls =
    side === "left"
      ? "left-0 top-0 bottom-0 max-w-[88vw] w-[320px]"
      : side === "right"
      ? "right-0 top-0 bottom-0 max-w-[88vw] w-[320px]"
      : "left-0 right-0 bottom-0 max-h-[92vh]";

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} direction={direction}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
        <Drawer.Content
          className={cn(
            "fixed z-50 outline-none flex flex-col",
            "bg-[var(--color-bg-elevated)]",
            "border-[var(--color-border)]",
            side === "left" && "border-r",
            side === "right" && "border-l",
            side === "bottom" && "border-t rounded-t-[20px]",
            positionCls,
            className,
          )}
        >
          <Drawer.Title className="sr-only">Panel</Drawer.Title>
          <Drawer.Description className="sr-only">Panel lateral de navegación</Drawer.Description>
          {children}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
