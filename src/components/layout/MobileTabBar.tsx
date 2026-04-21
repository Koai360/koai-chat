import { House, MessageSquare, BarChart3, Image as ImageIcon, Settings } from "lucide-react";
import type { Page } from "@/hooks/useNavigation";

interface Props {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

const TABS: { page: Page; icon: typeof House; label: string }[] = [
  { page: "home", icon: House, label: "Inicio" },
  { page: "chatHistory", icon: MessageSquare, label: "Chat" },
  { page: "dashboard", icon: BarChart3, label: "Dashboard" },
  { page: "media", icon: ImageIcon, label: "Galería" },
  { page: "settings", icon: Settings, label: "Ajustes" },
];

export function MobileTabBar({ currentPage, onNavigate }: Props) {
  const activePage = currentPage === "chat" ? "chatHistory" : currentPage;

  return (
    <nav
      className="md:hidden shrink-0 border-t border-border hide-on-keyboard"
      style={{
        backgroundColor: "var(--color-bg)",
        // Padding inferior: respeta home indicator (~34px en iPhones nuevos)
        // con mínimo de 12px para devices sin indicator.
        paddingBottom: "max(12px, env(safe-area-inset-bottom))",
      }}
      aria-label="Navegación principal"
    >
      <div className="flex items-center justify-around h-[52px]">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activePage === tab.page;
          return (
            <button
              key={tab.page}
              onClick={() => onNavigate(tab.page)}
              aria-label={tab.label}
              aria-current={isActive ? "page" : undefined}
              className={`
                relative flex flex-col items-center justify-center gap-1 flex-1 h-full
                transition-colors duration-200
                ${isActive ? "text-noa" : "text-text-subtle"}
              `}
            >
              {/* Active indicator — top line 2px lime con glow */}
              {isActive && (
                <span
                  aria-hidden
                  className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-7 rounded-full"
                  style={{
                    backgroundColor: "var(--color-noa)",
                    boxShadow: "0 0 8px var(--color-noa-glow)",
                  }}
                />
              )}
              <Icon
                className="w-[22px] h-[22px]"
                strokeWidth={isActive ? 2 : 1.5}
              />
              <span
                className={`text-[10px] leading-none ${isActive ? "font-semibold" : "font-normal"}`}
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
