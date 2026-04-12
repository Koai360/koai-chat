import { House, MessageSquare, BarChart3, Image, Settings } from "lucide-react";
import type { Page } from "@/hooks/useNavigation";

interface Props {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

const TABS: { page: Page; icon: typeof House; label: string }[] = [
  { page: "home", icon: House, label: "Inicio" },
  { page: "chatHistory", icon: MessageSquare, label: "Chat" },
  { page: "dashboard", icon: BarChart3, label: "Dashboard" },
  { page: "media", icon: Image, label: "Galería" },
  { page: "settings", icon: Settings, label: "Ajustes" },
];

export function MobileTabBar({ currentPage, onNavigate }: Props) {
  const activePage = currentPage === "chat" ? "chatHistory" : currentPage;

  return (
    <nav
      className="md:hidden shrink-0 border-t border-border"
      style={{
        backgroundColor: "var(--color-bg)",
        // Padding inferior = solo lo necesario para no solapar con el
        // home indicator (12px). Estilo Grok / Instagram: la tab bar
        // queda pegada al borde inferior sin "flotar" con safe-area-inset
        // completo (que son ~34px en iPhones con home indicator).
        paddingBottom: "12px",
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
                flex flex-col items-center justify-center gap-1 flex-1 h-full
                transition-colors duration-200
                ${isActive ? "text-noa" : "text-text-subtle"}
              `}
            >
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
