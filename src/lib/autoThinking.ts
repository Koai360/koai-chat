import type { ThinkingLevel } from "@/types/api";

/**
 * Modos del ModelPicker — solo dos opciones explícitas, sin auto.
 *
 *   standard → Gemini 3.5 Flash (sin thinking) — instant, día a día
 *   pro      → Gemini 3.5 Pro thinking=high — análisis profundo
 */
export type ModelMode = "standard" | "pro";

export function resolveThinkingLevel(mode: ModelMode): ThinkingLevel {
  switch (mode) {
    case "standard":
      return "low";
    case "pro":
      return "high";
  }
}
