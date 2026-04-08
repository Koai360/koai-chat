import { useEffect, useCallback } from "react";

type Theme = "dark" | "light";

/**
 * useTheme — tema dark FIJO (decisión de producto, light mode eliminado).
 *
 * El hook se mantiene como API para no romper consumidores existentes
 * (ContentTopBar, AppShell), pero siempre fuerza dark y los setters son no-op.
 * Cualquier valor previo en localStorage queda obsoleto.
 */
const FIXED_THEME: Theme = "dark";
const BG_COLOR = "#0a0a0c";

export function useTheme() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light");
    root.classList.add("dark");
    root.style.colorScheme = "dark";

    // Tailwind v4 @theme compiles var(--color-bg) statically,
    // so we set body/html bg via JS to match the active theme. Critical para iOS
    // PWA donde el body bg se muestra detrás de safe areas.
    document.body.style.backgroundColor = BG_COLOR;
    document.documentElement.style.backgroundColor = BG_COLOR;

    // theme-color meta para status bar iOS PWA
    const meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    if (meta) {
      meta.setAttribute("content", BG_COLOR);
    }

    // Limpiar localStorage de la preferencia de tema antigua
    try {
      localStorage.removeItem("koai-theme");
    } catch {
      /* ignore */
    }
  }, []);

  // Setters no-op para compatibilidad
  const setTheme = useCallback((_t: Theme) => {}, []);
  const toggleTheme = useCallback(() => {}, []);

  return { theme: FIXED_THEME, setTheme, toggleTheme } as const;
}
