import { cn } from "@/lib/cn";

/**
 * NoaWordmark — la marca de Noa (wordmark en su degradado azul → cian, con el acento violeta).
 *
 * S332: porta la decisión de Jesús del 2026-08-22 en noa-ios: el logo nuevo es la identidad de
 * Noa y va SIEMPRE en su color (nunca teñido); el lima queda como acento de acción. Reemplaza al
 * cerebro hexagonal (`Sparkle`) en login, saludo, sidebar y arriba de cada respuesta.
 *
 * Es un `<img>` del SVG y no un inline: el archivo trae sus propios gradientes con ids fijos,
 * y varias copias inline en la misma página colisionarían entre sí.
 */
export function NoaWordmark({ height = 22, className, decorative = false }: { height?: number; className?: string; decorative?: boolean }) {
  return (
    <img
      src="/brand/noa-wordmark.svg"
      alt={decorative ? "" : "Noa"}
      aria-hidden={decorative || undefined}
      height={height}
      style={{ height, width: "auto" }}
      className={cn("block select-none", className)}
      draggable={false}
    />
  );
}

/**
 * NoaMark — el símbolo solo (sin las letras), para los lugares chicos o animados:
 * indicador de "pensando", fallback de carga, error. `pulse` lo hace respirar.
 */
export function NoaMark({ size = 22, className, pulse = false }: { size?: number; className?: string; pulse?: boolean }) {
  return (
    <img
      src="/brand/noa-mark.svg"
      alt=""
      aria-hidden
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={cn("block select-none", pulse && "noa-pulse", className)}
      draggable={false}
    />
  );
}
