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
            if (id.includes("react-markdown") || id.includes("rehype") || id.includes("highlight")) {
              return "markdown";
            }
            if (id.includes("framer-motion")) return "motion";
            if (id.includes("radix-ui")) return "radix";
            if (id.includes("react-dom")) return "react";
            if (id.includes("@fontsource")) return "fonts";
            if (id.includes("lucide-react")) return "icons";
            return "vendor";
          }
          // Code-split por surface
          if (id.includes("/components/pages/")) return "pages";
          if (id.includes("/components/cards/")) return "cards";
          if (id.includes("/components/voice/")) return "voice";
        },
      },
    },
  },
});
