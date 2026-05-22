/**
 * Class name helper — concatena clases filtrando falsy.
 * Sustituye clsx + tailwind-merge para mantener el bundle liviano.
 *
 * Para casos donde dos clases Tailwind colisionan (ej. `bg-red-500 bg-blue-500`),
 * la última gana naturalmente porque el orden CSS de Tailwind 4 ya resuelve.
 * Si en algún caso hace falta merge real, agregar `tailwind-merge` puntual.
 */
export type ClassValue = string | number | null | undefined | false | ClassValue[];

export function cn(...inputs: ClassValue[]): string {
  const out: string[] = [];
  const walk = (v: ClassValue): void => {
    if (!v) return;
    if (typeof v === "string" || typeof v === "number") {
      out.push(String(v));
      return;
    }
    if (Array.isArray(v)) {
      v.forEach(walk);
    }
  };
  inputs.forEach(walk);
  return out.join(" ");
}
