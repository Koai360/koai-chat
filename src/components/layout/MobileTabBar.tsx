import { House, MessageSquare, Image, Settings } from "lucide-react";
import type { Page } from "@/hooks/useNavigation";

interface Props {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

const TABS: { page: Page; icon: typeof House; label: string }[] = [
  { page: "home", icon: House, label: "Inicio" },
  { page: "chatHistory", icon: MessageSquare, label: "Chat" },
  { page: "media", icon: Image, label: "Galería" },
  { page: "settings", icon: Settings, label: "Ajustes" },
];

export function MobileTabBar({ currentPage, onNavigate }: Props) {
  const activePage = currentPage === "chat" ? "chatHistory" : currentPage;

  return (
    <nav className="md:hidden shrink-0" style={{ backgroundColor: "var(--color-bg)" }}>
      <div className="flex items-center justify-around h-[50px]">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activePage === tab.page;
          return (
            <button
              key={tab.page}
              onClick={() => onNavigate(tab.page)}
              aria-label={tab.label}
              className="flex flex-col items-center justify-center gap-1 flex-1 h-full transition-all duration-200"
            >
              <Icon
                className="w-5 h-5 transition-colors duration-200"
                strokeWidth={1.5}
                style={{
                  color: isActive ? "#D4E94B" : "rgba(255, 255, 255, 0.4)",
                }}
              />
              <span
                className="text-[10px] leading-none transition-colors duration-200"
                style={{
                  color: isActive ? "#D4E94B" : "rgba(255, 255, 255, 0.4)",
                  fontWeight: isActive ? 600 : 400,
                }}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
