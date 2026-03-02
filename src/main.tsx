import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Register service worker + auto-update
if ("serviceWorker" in navigator) {
  // Solo recargar si ya había un SW controlando (= es una actualización, no primer load)
  const hadController = !!navigator.serviceWorker.controller;
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (hadController && !refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").then((reg) => {
      // Check for updates every 60s
      setInterval(() => reg.update(), 60000);
    }).catch(() => {});
  });
}
