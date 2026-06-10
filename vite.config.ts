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
    // No preloadear chunks no críticos del first paint (login screen):
    // - `pages` solo entra al navegar a Galería/Historial/Settings
    // - `markdown` solo entra cuando hay mensaje del asistente
    // - `cards` solo entra cuando un mensaje contiene markers card:
    // El browser los descarga on-demand. P1-7 audit.
    modulePreload: {
      resolveDependencies: (_url, deps) =>
        deps.filter((d) => !/(pages|markdown|cards)-[A-Za-z0-9_-]+\.js$/.test(d)),
    },
    rollupOptions: {
      output: {
        // NO splitamos node_modules — split agresivo causa race conditions con
        // libs que dependen de React (Radix, framer-motion, sonner, vaul):
        // si Radix carga antes que React core esté inicializado, falla con
        // "Cannot read properties of undefined (reading 'useLayoutEffect')".
        // Dejamos que rollup haga su pesado de imports natural.
        //
        // Sí splitimos surfaces propias para lazy loading:
        manualChunks(id) {
          // Markdown ecosystem se puede aislar porque NO depende de React
          // como peer crítico (renderiza children como tree React, no lo
          // necesita en module-init time)
          if (id.includes("node_modules")) {
            if (
              id.includes("react-markdown") ||
              id.includes("rehype") ||
              id.includes("/lowlight/") ||
              id.includes("/highlight.js/") ||
              id.includes("/micromark") ||
              id.includes("/mdast-")
            ) {
              return "markdown";
            }
            // Resto: vendor único — rollup ordena cargas
            return undefined;
          }
          // Code-split por surface — P1-7 audit: ahora cargadas vía React.lazy()
          // desde AppShell, así pages no entra en first-load. cards sigue eager
          // porque MessageBubble los importa estático (renderiza inline).
          if (id.includes("/components/pages/")) return "pages";
          if (id.includes("/components/cards/")) return "cards";
        },
      },
    },
  },
});
