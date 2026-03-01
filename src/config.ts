export const API_URL = import.meta.env.VITE_API_URL || "https://api.koai360.com";
export const API_KEY = import.meta.env.VITE_API_KEY || "koai-dev-2026";

export function getAuthToken(): string | null {
  return localStorage.getItem("koai-chat-token");
}
