import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/sora/400.css";
import "@fontsource/sora/500.css";
import "@fontsource/sora/600.css";
import "@fontsource/sora/700.css";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/dm-sans/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "./index.css";
import App from "./App.tsx";

// Initialize theme before render to prevent flash
const stored = localStorage.getItem("koai-theme");
const theme = stored === "light" ? "light" : "dark";
document.documentElement.classList.add(theme);
document.documentElement.style.colorScheme = theme;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Register service worker (updates on natural page load only)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
