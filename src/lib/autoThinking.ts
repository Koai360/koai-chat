import type { ThinkingLevel } from "@/types/api";

/**
 * Modos del ModelPicker (sin auto).
 *
 *   standard → modelo por defecto del backend (hoy Gemini 4 Hydrogen), thinking=medium
 *   pro      → el mismo modelo por defecto, thinking=high — análisis profundo
 *   neon     → Gemini 4 Neon (19-nov-2026), thinking=medium
 *   argon    → Gemini 4 Argon (S388), thinking=medium
 *   carbon   → Gemini 4 Carbon (S418), thinking=medium
 *
 * El modelo por defecto lo decide el backend (`KOAI_NOA_MODEL`): la app no lo nombra.
 */
export type ModelMode = "standard" | "pro" | "neon" | "argon" | "carbon";

export const MODEL_MODES: readonly ModelMode[] = ["standard", "pro", "neon", "argon", "carbon"];

export function resolveThinkingLevel(mode: ModelMode): ThinkingLevel {
  switch (mode) {
    case "standard":
      return "medium";
    case "pro":
      return "high";
    case "neon":
    case "argon":
    case "carbon":
      // Los Gemini 4 elegibles van al mismo nivel que Estándar: se compara el modelo,
      // no el razonamiento (S388, S418; Neon desde el 19-nov-2026).
      return "medium";
  }
}

/** Modos que piden un Gemini 4 explícito en el payload. */
type ExplicitNoaModel = "neon" | "argon" | "carbon";

/**
 * Modelo de Noa para el payload (S388). Sólo los Gemini 4 elegibles viajan explícitos;
 * en Estándar y Pro se manda `undefined` y el backend aplica su default (una sola fuente
 * de verdad, igual que el motor de imagen "auto").
 */
export function resolveNoaModel(mode: ModelMode): ExplicitNoaModel | undefined {
  return mode === "neon" || mode === "argon" || mode === "carbon" ? mode : undefined;
}
