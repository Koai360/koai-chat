import { useState, useCallback, useEffect } from "react";

export type Page = "home" | "chat" | "chatHistory" | "explore" | "media" | "notes" | "dashboard" | "settings";

const HASH_MAP: Record<string, Page> = {
  "": "home",
  "#/": "home",
  "#/home": "home",
  "#/chat": "chat",
  "#/history": "chatHistory",
  "#/explore": "explore",
  "#/media": "media",
  "#/notes": "notes",
  "#/dashboard": "dashboard",
  "#/settings": "settings",
};

const PAGE_HASH: Record<Page, string> = {
  home: "#/home",
  chat: "#/chat",
  chatHistory: "#/history",
  explore: "#/explore",
  media: "#/media",
  notes: "#/notes",
  dashboard: "#/dashboard",
  settings: "#/settings",
};

function getPageFromHash(): Page {
  const hash = window.location.hash;
  return HASH_MAP[hash] || "home";
}

export function useNavigation() {
  const [currentPage, setCurrentPage] = useState<Page>(getPageFromHash);

  useEffect(() => {
    const handler = () => setCurrentPage(getPageFromHash());
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  const navigate = useCallback((page: Page) => {
    window.location.hash = PAGE_HASH[page];
    setCurrentPage(page);
  }, []);

  return { currentPage, navigate } as const;
}
