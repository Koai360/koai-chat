import { House, MessageSquare, Compass, Image, Settings } from "lucide-react";
import type { Page } from "@/hooks/useNavigation";

interface Props {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

const TABS: { page: Page; icon: typeof House; label: string }[] = [
  { page: "home", icon: House, label: "Inicio" },
  { page: "chat", icon: MessageSquare, label: "Chat" },
  { page: "explore", icon: Compass, label: "Explorar" },
  { page: "media", icon: Image, label: "Media" },
  { page: "settings", icon: Settings, label: "Ajustes" },
];

export function MobileTabBar({ currentPage, onNavigate }: Props) {
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-bg-sidebar border-t border-border"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex items-center justify-around h-[56px]">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentPage === tab.page;
          return (
            <button
              key={tab.page}
              onClick={() => onNavigate(tab.page)}
              className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors"
            >
              <Icon
                className={`w-5 h-5 ${isActive ? "text-text" : "text-text-muted"}`}
              />
              <span
                className={`text-[10px] leading-none ${
                  isActive ? "text-text font-medium" : "text-text-muted"
                }`}
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
