import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MotionConfig } from "framer-motion";
import App from "./App";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { NoaMarkSprite } from "@/components/chat/NoaMarkSprite";
import { registerServiceWorker } from "@/lib/sw";
import "./styles/globals.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* Fuera del ErrorBoundary: si App revienta, el icono del fallback igual
        tiene su sprite para referenciar. */}
    <NoaMarkSprite />
    <ErrorBoundary>
      <MotionConfig reducedMotion="user">
        <App />
      </MotionConfig>
    </ErrorBoundary>
  </StrictMode>
);

registerServiceWorker();
