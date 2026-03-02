import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Register service worker + background update (no auto-reload)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").then((reg) => {
      // Check for updates every 60s — SW se actualiza en background,
      // el usuario recibe la nueva versión al próximo load natural
      setInterval(() => reg.update(), 60000);
    }).catch(() => {});
  });
}
