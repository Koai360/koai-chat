import { useEffect } from "react";

/**
 * S161: teclado iOS en PWA standalone — WebKit NO reduce el layout viewport
 * al abrir el teclado: "empuja" la ventana entera hacia arriba (TopBar fuera
 * de pantalla, contenido sobre el status bar, página corrida al cerrar).
 *
 * Fix: cuando el visualViewport se achica (teclado), encogemos html/body/#root
 * a la altura visible (var --vvh, ver globals.css) y deshacemos el push de iOS.
 * Header + thread + input quedan en pantalla, como app nativa.
 *
 * v2 (mismo día, tras probar en device):
 * - Baseline robusta: window.innerHeight NO es confiable en iOS 26 standalone
 *   (a veces sigue al visual viewport → Δ≈0 y el teclado no se detectaba →
 *   input tapado). El teclado solo puede ACHICAR vv.height, así que la
 *   baseline es el MÁXIMO vv.height visto; se resetea al rotar.
 * - scrollTo(0,0) SOLO en transiciones abre/cierra + post-focus. Hacerlo en
 *   cada evento de vv peleaba con el scroll elástico de iOS y se sentía como
 *   un tirón al tocar la pantalla.
 *
 * Solo corre en touch (pointer: coarse) — en desktop no hay teclado overlay.
 */
export function useKeyboardViewport() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    if (!window.matchMedia?.("(pointer: coarse)").matches) return;

    const root = document.documentElement;
    let rafId = 0;
    let baseline = vv.height;
    let wasOpen = false;

    const apply = () => {
      rafId = 0;
      if (vv.height > baseline) baseline = vv.height;
      const open = baseline - vv.height > 150;
      if (open) {
        root.style.setProperty("--vvh", `${Math.round(vv.height)}px`);
        root.dataset.keyboard = "open";
      } else {
        root.dataset.keyboard = "closed";
        root.style.removeProperty("--vvh");
      }
      if (open !== wasOpen) {
        wasOpen = open;
        // Deshacer el push de WebKit al abrir / página corrida al cerrar
        if (window.scrollY !== 0) window.scrollTo(0, 0);
      }
    };

    const schedule = () => {
      if (!rafId) rafId = requestAnimationFrame(apply);
    };

    // iOS auto-scrollea el window al enfocar un input aunque el layout ya
    // quepa entero — deshacerlo cuando el teclado termina de animar (~300ms)
    const onFocusIn = (e: FocusEvent) => {
      const t = e.target as HTMLElement | null;
      const editable =
        t && (/^(INPUT|TEXTAREA)$/.test(t.tagName) || t.isContentEditable);
      if (!editable) return;
      window.setTimeout(() => {
        if (window.scrollY !== 0) window.scrollTo(0, 0);
        schedule();
      }, 350);
    };

    const onOrientation = () => {
      baseline = 0; // re-aprender la altura en la orientación nueva
      schedule();
    };

    vv.addEventListener("resize", schedule);
    window.addEventListener("focusin", onFocusIn);
    window.addEventListener("orientationchange", onOrientation);
    return () => {
      vv.removeEventListener("resize", schedule);
      window.removeEventListener("focusin", onFocusIn);
      window.removeEventListener("orientationchange", onOrientation);
      if (rafId) cancelAnimationFrame(rafId);
      delete root.dataset.keyboard;
      root.style.removeProperty("--vvh");
    };
  }, []);
}
