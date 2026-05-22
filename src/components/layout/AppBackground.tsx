/**
 * AppBackground — capa visual fija detrás de toda la app.
 *
 * Implementación CSS-only en globals.css (.app-bg) con:
 * - Black base + indigo gradient bottom-up + violet glow
 * - Breath animation 18s (opacity 1.0 ↔ 0.85)
 * - Respeta prefers-reduced-motion (sin animación)
 *
 * En Fase 1+ agregamos opcional aurora particle field (canvas) detrás de este layer.
 */
export function AppBackground() {
  return <div className="app-bg" aria-hidden />;
}
