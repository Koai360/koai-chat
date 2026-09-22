import { useEffect } from "react";

/** Evento interno para abrir el buscador desde cualquier botón (sidebar, rail). */
export const PALETTE_EVENT = "noa:palette";
export function openPalette(): void {
  window.dispatchEvent(new Event(PALETTE_EVENT));
}

/** ⌘ en Mac, Ctrl en el resto. Se resuelve una vez: el teclado no cambia en la sesión. */
export const IS_MAC =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);
export const MOD_LABEL = IS_MAC ? "⌘" : "Ctrl";

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

interface Hotkeys {
  /** ⌘K / Ctrl+K — buscador de conversaciones y acciones. */
  onPalette: () => void;
  /** ⌘⇧O / Ctrl+Shift+O — nuevo chat (convención de los chats de escritorio; ⌘N lo reserva el navegador). */
  onNewChat: () => void;
  /** `/` fuera de un campo de texto — foco al input del chat. */
  onFocusInput: () => void;
}

/**
 * useHotkeys — atajos globales de escritorio (S332, F1 del plan; Nielsen #7 estaba en 1/4).
 *
 * Reglas: los atajos con modificador funcionan siempre (incluso escribiendo); `/` sólo cuando
 * no hay un campo de texto enfocado, para no romper el tipeo. Nada se registra en pantallas
 * táctiles puras: ahí no hay teclado físico que lo dispare y `/` es un carácter normal.
 */
export function useHotkeys({ onPalette, onNewChat, onFocusInput }: Hotkeys): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = IS_MAC ? e.metaKey : e.ctrlKey;
      if (mod && !e.altKey && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        onPalette();
        return;
      }
      if (mod && e.shiftKey && (e.key === "o" || e.key === "O")) {
        e.preventDefault();
        onNewChat();
        return;
      }
      if (e.key === "/" && !mod && !e.altKey && !isTypingTarget(e.target)) {
        e.preventDefault();
        onFocusInput();
      }
    };
    const onPaletteEvent = () => onPalette();
    document.addEventListener("keydown", onKey);
    window.addEventListener(PALETTE_EVENT, onPaletteEvent);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener(PALETTE_EVENT, onPaletteEvent);
    };
  }, [onPalette, onNewChat, onFocusInput]);
}
