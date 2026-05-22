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
export type ModelMode = "standard" | "pro";

export function resolveThinkingLevel(mode: ModelMode): ThinkingLevel {
  switch (mode) {
    case "standard":
      return "medium";
    case "pro":
      return "high";
  }
}
