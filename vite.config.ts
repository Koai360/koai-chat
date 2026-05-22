import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    target: "es2022",
    cssCodeSplit: true,
    chunkSizeWarningLimit: 800,
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
          // Code-split por surface (app code) — lazy loading natural
          if (id.includes("/components/pages/")) return "pages";
          if (id.includes("/components/cards/")) return "cards";
          if (id.includes("/components/voice/")) return "voice";
        },
      },
    },
  },
});
