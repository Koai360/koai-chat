/**
 * Motor de generación de imágenes elegible desde el chat (S228).
 *
 * "auto" NO se manda al backend (se envía undefined) — así el default queda
 * definido en un solo lugar, el backend, y no hay dos fuentes de verdad sobre
 * qué es la cadena por defecto.
 *
 * Los IDs deben coincidir con SELECTABLE_IMAGE_ENGINES de
 * koai/tools/image_gen_tools.py — el backend ignora cualquier valor fuera de
 * esa whitelist y cae a Auto.
 */
export type ImageEngine = "auto" | "gpt" | "nbp" | "grok";

const STORAGE_KEY = "noa:imageEngine";

const VALID: readonly ImageEngine[] = ["auto", "gpt", "nbp", "grok"];

/** Valor para el payload: `undefined` cuando es Auto (el backend decide). */
export function resolveImageEngine(engine: ImageEngine): string | undefined {
  return engine === "auto" ? undefined : engine;
}

export function loadImageEngine(): ImageEngine {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return VALID.includes(saved as ImageEngine) ? (saved as ImageEngine) : "auto";
  } catch {
    return "auto";
  }
}

export function saveImageEngine(engine: ImageEngine): void {
  try {
    localStorage.setItem(STORAGE_KEY, engine);
  } catch {
    // Safari privado: localStorage tira. La elección vale para esta sesión.
  }
}
