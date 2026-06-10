import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import fs from "fs";

// S158 — el SW tenía VERSION hardcodeada "noa-v3.0.0": al nunca cambiar los
// bytes de sw.js, el browser jamás re-instalaba el worker → precache del index
// congelado → iOS corría bundles viejos tras cada deploy. Este plugin estampa
// una versión única por build en dist/sw.js (post-copy de public/).
function stampServiceWorkerVersion(): Plugin {
  return {
    name: "stamp-sw-version",
    apply: "build",
    closeBundle() {
      const swPath = path.resolve(__dirname, "dist/sw.js");
      if (!fs.existsSync(swPath)) return;
      const stamp = `noa-v3-${new Date().toISOString().replace(/[:.]/g, "-")}`;
      const src = fs.readFileSync(swPath, "utf8");
      fs.writeFileSync(swPath, src.replace(/__SW_VERSION__/g, stamp));
      console.log(`[sw] versión estampada: ${stamp}`);
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), stampServiceWorkerVersion()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    target: "es2022",
    cssCodeSplit: true,
    chunkSizeWarningLimit: 800,
    // S158-b (audit P1): el filtro de modulePreload + manualChunks de
    // pages/cards estaban ROTOS en el build real — rollup colocaba vendors
    // compartidos (React incluido) dentro de los chunks "pages"/"cards", que
    // por eso terminaban importados ESTÁTICAMENTE por index sin preload hints
    // → waterfall secuencial de ~1.05MB que bloqueaba hasta el login.
    // Fix: sin filtro de preload (los hints paralelos eliminan el waterfall) y
    // sin manualChunks de app code — pages se splitea solo vía React.lazy
    // (AppShell) y markdown vía el wrapper lazy de NoaMarkdown.
    // Sin manualChunks: el split natural de rollup respeta los boundaries
    // dinámicos (React.lazy de pages + LazyNoaMarkdown) — forzar chunks con
    // manualChunks colocaba vendors compartidos dentro de "pages"/"cards"/
    // "markdown" y los volvía imports ESTÁTICOS de index (waterfall). NO
    // re-agregar split agresivo de node_modules (race conditions con libs
    // que dependen de React: Radix, framer-motion, sonner, vaul).
  },
});
