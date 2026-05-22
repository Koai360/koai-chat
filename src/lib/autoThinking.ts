import type { ThinkingLevel } from "@/types/api";

/**
 * autoThinkingLevel — clasifica el mensaje del usuario y devuelve el nivel
 * de "thinking" óptimo para Gemini 3.5 Flash:
 *
 *   low    → ack, saludos, factuales triviales. Respuesta inmediata.
 *   medium → conversación normal. Default cuando nada destaca.
 *   high   → análisis, planeación, código, multi-pregunta, comparación.
 *
 * Heurísticas simples y conservadoras — más vale subestimar el level
 * (más rápido) que sobreestimarlo (más caro y lento). Mantener todas las
 * señales aquí para que un cambio único actualice el behavior global.
 */
export function autoThinkingLevel(text: string): ThinkingLevel {
  const raw = text.trim();
  if (!raw) return "medium";
  const lower = raw.toLowerCase();
  const len = raw.length;
  const words = raw.split(/\s+/).filter(Boolean);
  const firstWord = words[0]?.toLowerCase() ?? "";

  // 1) Triviales: saludos, ack, ultra-cortas
  const ackFirstWords = new Set([
    "hola", "hey", "buenas", "buenos", "buen", "saludos",
    "si", "sí", "no", "ok", "okey", "okay", "vale", "dale",
    "gracias", "thanks", "thx", "listo", "claro", "perfecto",
    "chao", "bye", "adios", "adiós", "nos", "ya",
  ]);
  if (ackFirstWords.has(firstWord) && words.length <= 4) return "low";
  if (len <= 18 && !raw.includes("?") && !raw.includes("¿")) return "low";

  // 2) Pro: keywords explícitas de análisis/planeación/código/comparación
  const proKeywords = [
    // análisis
    "analiza", "análisis", "analisis", "evalúa", "evalua", "evaluación",
    "deep dive", "investiga", "investigación", "investigacion",
    "explica detalladamente", "explicame paso a paso", "explica paso a paso",
    "explica a fondo", "explícame a fondo", "razona",
    // planeación / estrategia
    "plan ", "planea", "planifica", "estrategia", "estratégico", "roadmap",
    "diseña", "diseño", "arquitectura", "arquitectónico",
    "pros y contras", "trade-off", "tradeoff", "ventajas y desventajas",
    "compara", "comparación", "comparacion", "vs ", "versus",
    // código / técnico
    "código", "codigo", "implementa", "implementación", "implementacion",
    "refactoriza", "refactor", "debuggea", "debug", "optimiza", "optimización",
    "schema sql", "query sql", "arregla este bug", "diagrama",
    // reportes / detalle
    "reporte completo", "informe", "resumen ejecutivo", "summary completo",
    "explícame todo", "explicame todo", "todo lo que sepas",
  ];
  for (const kw of proKeywords) {
    if (lower.includes(kw)) return "high";
  }

  // 3) Pro por estructura: mensaje largo, multi-pregunta
  const questionMarks = (raw.match(/[?¿]/g) || []).length;
  if (len > 320) return "high";
  if (questionMarks >= 3) return "high";

  // 4) Default
  return "medium";
}

/**
 * Modos del ModelPicker — incluye Auto que delega a autoThinkingLevel.
 */
export type ModelMode = "auto" | "standard" | "pro";

export function resolveThinkingLevel(mode: ModelMode, text: string): ThinkingLevel {
  switch (mode) {
    case "auto":
      return autoThinkingLevel(text);
    case "standard":
      return "medium";
    case "pro":
      return "high";
  }
}
