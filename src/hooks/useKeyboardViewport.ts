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
 * v3 (S239) — el input saltaba al TOPE, encima del reloj, con un hueco negro
 * gigante entre el teclado y la barra:
 * - Deshacer el push de WebKit con scrollTo(0,0) NO PUEDE funcionar acá: al
 *   encoger html/body/#root a --vvh el documento mide exactamente el área
 *   visible → no hay nada que scrollear → scrollY ya es 0 y el scrollTo es un
 *   no-op, mientras WebKit mantiene la ventana empujada. La app corta quedaba
 *   pegada al tope del layout viewport (bajo el notch) y el resto, negro.
 * - El desplazamiento real se lee en visualViewport.pageTop (offsetTop del
 *   push + scrollY si el documento sí scrollea). Se publica como --vv-shift y
 *   globals.css lo compensa con un translateY sobre #root: no toca el layout
 *   (el documento sigue midiendo --vvh, sin scroll) y la app se apoya exacto
 *   sobre el teclado.
 * - Hay que escuchar 'scroll' del visualViewport, no sólo 'resize': el push
 *   puede llegar DESPUÉS del resize (o sin resize alguno) y con sólo resize
 *   nunca nos enterábamos.
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

    // Cuánto se corrió el área visible respecto del documento. pageTop ya
    // suma el push de WebKit (offsetTop) y el scroll real; el fallback cubre
    // motores viejos sin pageTop. Se acota a [0, alto del teclado]: el rebote
    // elástico de iOS lo manda a negativo por unos frames y la app pegaba un
    // tirón hacia abajo.
    const shiftOf = (kbHeight: number) => {
      const raw =
        typeof vv.pageTop === "number" ? vv.pageTop : vv.offsetTop + window.scrollY;
      return Math.min(Math.max(Math.round(raw), 0), Math.round(kbHeight));
    };

    const apply = () => {
      rafId = 0;
      if (vv.height > baseline) baseline = vv.height;
      const kbHeight = baseline - vv.height;
      const open = kbHeight > 150;
      if (open) {
        root.style.setProperty("--vvh", `${Math.round(vv.height)}px`);
        root.style.setProperty("--vv-shift", `${shiftOf(kbHeight)}px`);
        root.dataset.keyboard = "open";
      } else {
        root.dataset.keyboard = "closed";
        root.style.removeProperty("--vvh");
        root.style.removeProperty("--vv-shift");
      }
      if (open !== wasOpen) {
        wasOpen = open;
        // Deshacer el push de WebKit al abrir / página corrida al cerrar.
        // Cuando el documento no scrollea esto es no-op y el trabajo real lo
        // hace --vv-shift (ver cabecera v3).
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
    vv.addEventListener("scroll", schedule);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("focusin", onFocusIn);
    window.addEventListener("orientationchange", onOrientation);
    return () => {
      vv.removeEventListener("resize", schedule);
      vv.removeEventListener("scroll", schedule);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("focusin", onFocusIn);
      window.removeEventListener("orientationchange", onOrientation);
      if (rafId) cancelAnimationFrame(rafId);
      delete root.dataset.keyboard;
      root.style.removeProperty("--vvh");
      root.style.removeProperty("--vv-shift");
    };
  }, []);
}
