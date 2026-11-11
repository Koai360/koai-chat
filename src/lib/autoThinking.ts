import type { ThinkingLevel } from "@/types/api";

/**
 * Modos del ModelPicker — solo dos opciones explícitas, sin auto.
 *
 *   standard → Gemini 3.5 Pro thinking=medium — balance ~3-6s, robusto
 *   pro      → Gemini 3.5 Pro thinking=high   — análisis profundo ~8-20s
 *
 * Flash (thinking_level=low) se removió del UI: en mensajes largos/complejos
 * a veces emitía respuestas vacías. Pro medium es más confiable como default
 * aunque pierde el "instant" del chitchat.
 */
export type ModelMode = "standard" | "pro" | "argon" | "carbon";

export const MODEL_MODES: readonly ModelMode[] = ["standard", "pro", "argon", "carbon"];

export function resolveThinkingLevel(mode: ModelMode): ThinkingLevel {
  switch (mode) {
    case "standard":
      return "medium";
    case "pro":
      return "high";
    case "argon":
      // S388: Gemini 4 Argon, prueba con uso real. Mismo nivel que Estándar para
      // comparar modelo contra modelo, no razonamiento contra razonamiento.
      return "medium";
    case "carbon":
      // S418: Gemini 4 Carbon (el tope de gama). Mismo nivel que Estándar y Argon,
      // por la misma razón: se compara el modelo.
      return "medium";
  }
}

/**
 * Modelo de Noa para el payload (S388). Sólo los Gemini 4 ("argon", "carbon") viajan
 * explícitos; en los modos Flash se manda `undefined` y el backend aplica su default
 * (una sola fuente de verdad, igual que el motor de imagen "auto").
 */
export function resolveNoaModel(mode: ModelMode): "argon" | "carbon" | undefined {
  return mode === "argon" || mode === "carbon" ? mode : undefined;
}
