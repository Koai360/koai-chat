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
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            // CRÍTICO: react + react-dom + scheduler DEBEN ir juntos.
            // Si quedan separados, scheduler intenta poblar React internals
            // antes de que React esté inicializado → TypeError "unstable_now".
            if (
              id.includes("/react/") ||
              id.includes("/react-dom/") ||
              id.includes("/scheduler/") ||
              id.includes("/use-sync-external-store/")
            ) {
              return "react";
            }
            if (id.includes("react-markdown") || id.includes("rehype") || id.includes("/lowlight/") || id.includes("/highlight.js/")) {
              return "markdown";
            }
            if (id.includes("framer-motion") || id.includes("/motion-dom/") || id.includes("/motion-utils/")) {
              return "motion";
            }
            if (id.includes("radix-ui") || id.includes("/@radix-ui/")) {
              return "radix";
            }
            if (id.includes("@fontsource")) return "fonts";
            if (id.includes("lucide-react")) return "icons";
            return "vendor";
          }
          // Code-split por surface (app code)
          if (id.includes("/components/pages/")) return "pages";
          if (id.includes("/components/cards/")) return "cards";
          if (id.includes("/components/voice/")) return "voice";
        },
      },
    },
  },
});
