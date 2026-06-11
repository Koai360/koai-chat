import { useEffect } from "react";

/**
 * S161: teclado iOS en PWA standalone — WebKit NO reduce el layout viewport
 * al abrir el teclado: "empuja" la ventana entera hacia arriba. Resultado:
 * el TopBar desaparece de pantalla, el contenido se monta sobre el status
 * bar (saludo bajo el reloj) y al cerrar el teclado la página puede quedar
 * corrida.
 *
 * Fix: cuando visualViewport detecta teclado (Δ altura > 150px), encogemos
 * html/body/#root a la altura visible (var --vvh, ver globals.css) y
 * anclamos window.scrollTo(0,0). Así TODO el layout (header + thread +
 * input) vive en el área visible sobre el teclado, como app nativa. Al
 * cerrar, restauramos altura y des-corremos el scroll.
 *
 * Solo corre en touch (pointer: coarse) — en desktop el teclado no overlay.
 * Detección por GEOMETRÍA del visualViewport (no focusin/focusout: el focus
 * no dice cuánto mide el teclado, y el accessory bar de iOS varía).
 */
export function useKeyboardViewport() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    if (!window.matchMedia?.("(pointer: coarse)").matches) return;

    const root = document.documentElement;
    let rafId = 0;

    const apply = () => {
      rafId = 0;
      const kbHeight = window.innerHeight - vv.height;
      const open = kbHeight > 150;
      if (open) {
        root.style.setProperty("--vvh", `${Math.round(vv.height)}px`);
        root.dataset.keyboard = "open";
        // WebKit corre la ventana al enfocar el input — anclar en 0 para que
        // el layout encogido quede alineado con la zona visible
        if (window.scrollY !== 0) window.scrollTo(0, 0);
      } else {
        root.dataset.keyboard = "closed";
        root.style.removeProperty("--vvh");
        // Página corrida tras cerrar teclado (bug clásico iOS) → restaurar
        if (window.scrollY !== 0) window.scrollTo(0, 0);
      }
    };

    // rAF-coalesced: iOS dispara resize/scroll en ráfaga durante la animación
    const schedule = () => {
      if (!rafId) rafId = requestAnimationFrame(apply);
    };

    vv.addEventListener("resize", schedule);
    vv.addEventListener("scroll", schedule);
    return () => {
      vv.removeEventListener("resize", schedule);
      vv.removeEventListener("scroll", schedule);
      if (rafId) cancelAnimationFrame(rafId);
      delete root.dataset.keyboard;
      root.style.removeProperty("--vvh");
    };
  }, []);
}
