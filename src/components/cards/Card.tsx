import { forwardRef, type ReactNode } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/cn";
import { IconButton } from "@/components/ui/IconButton";

interface CardProps extends Omit<HTMLMotionProps<"div">, "title" | "children"> {
  title?: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  pending?: boolean;
  onMore?: () => void;
  actions?: ReactNode;
  children?: ReactNode;
}

/**
 * Card — shell común para todas las cards inline.
 *
 * Variantes:
 * - Default: card-glass shell con header + body + actions
 * - pending=true: ribbon ámbar sutil en el border-top
 *
 * Animación de entrada: spring scale 0.96 → 1 + fade in.
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    { title, subtitle, icon, pending = false, onMore, actions, className, children, ...rest },
    ref,
  ) => {
    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className={cn(
          "card-glass relative overflow-hidden",
          "w-full max-w-[640px]",
          pending && "border-[var(--color-warning)]/35",
          className,
        )}
        {...rest}
      >
        {pending && (
          <div
            className="absolute top-0 left-0 right-0 h-[2px]"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, var(--color-warning) 30%, var(--color-warning) 70%, transparent 100%)",
            }}
          />
        )}

        {(title || icon || onMore) && (
          <div className="flex items-center gap-3 px-5 pt-4">
            {icon && <div className="text-white/70 flex-shrink-0">{icon}</div>}
            <div className="flex-1 min-w-0">
              {title && (
                <h3 className="text-[15px] font-medium text-white leading-snug truncate">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="text-xs text-white/55 truncate">{subtitle}</p>
              )}
            </div>
            {onMore && (
              <IconButton
                icon={<MoreHorizontal className="size-4" />}
                size="sm"
                variant="ghost"
                label="Más opciones"
                onClick={onMore}
              />
            )}
          </div>
        )}

        {children && <div className="px-5 py-4">{children}</div>}

        {actions && (
          <div className="px-5 pb-4 pt-1 flex items-center gap-2 flex-wrap">{actions}</div>
        )}
      </motion.div>
    );
  },
);
Card.displayName = "Card";
