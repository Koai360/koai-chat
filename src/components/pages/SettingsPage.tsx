import { useState } from "react";
import {
  UserCircle,
  SlidersHorizontal,
  Paintbrush,
  Bell,
  Link,
  CreditCard,
  Database,
  Shield,
  LogOut,
  Trash2,
  Mail,
  ChevronRight,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { AuthUser } from "@/hooks/useAuth";

interface Props {
  user: AuthUser;
  onLogout: () => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
}

type Section =
  | "account"
  | "preferences"
  | "personalization"
  | "notifications"
  | "integrations"
  | "subscription"
  | "data"
  | "security";

const NAV_ITEMS: { id: Section; label: string; icon: typeof UserCircle }[] = [
  { id: "account", label: "Cuenta", icon: UserCircle },
  { id: "preferences", label: "Preferencias", icon: SlidersHorizontal },
  { id: "personalization", label: "Personalización", icon: Paintbrush },
  { id: "notifications", label: "Notificaciones", icon: Bell },
  { id: "integrations", label: "Integraciones", icon: Link },
  { id: "subscription", label: "Suscripción", icon: CreditCard },
  { id: "data", label: "Control de datos", icon: Database },
  { id: "security", label: "Seguridad", icon: Shield },
];

export function SettingsPage({ user, onLogout, theme, onToggleTheme }: Props) {
  const [activeSection, setActiveSection] = useState<Section>("account");

  return (
    <div className="flex flex-col md:flex-row h-full">
      {/* Desktop: Side nav */}
      <nav className="hidden md:flex flex-col w-[200px] shrink-0 liquid-glass p-3 gap-0.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-all duration-200 text-left ${
                activeSection === item.id
                  ? "bg-white/[0.08] text-text font-medium"
                  : "text-text-muted hover:text-text hover:bg-white/[0.03]"
              }`}
            >
              <Icon className="size-4 shrink-0" />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Mobile: Top tabs (horizontal scroll) */}
      <div className="md:hidden flex overflow-x-auto no-scrollbar border-b border-border px-2 py-1.5 gap-1 shrink-0 bg-bg z-10">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md transition-colors whitespace-nowrap shrink-0 ${
                activeSection === item.id
                  ? "bg-bg-surface text-text font-medium"
                  : "text-text-muted"
              }`}
            >
              <Icon className="size-3.5" />
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 h-full">
        <div className="p-6 max-w-xl">
          {activeSection === "account" && (
            <AccountSection user={user} onLogout={onLogout} />
          )}
          {activeSection === "preferences" && (
            <PreferencesSection theme={theme} onToggleTheme={onToggleTheme} />
          )}
          {activeSection !== "account" && activeSection !== "preferences" && (
            <ComingSoon label={NAV_ITEMS.find((n) => n.id === activeSection)?.label || ""} />
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

/* ─── Account ─── */

function AccountSection({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-medium text-text font-display animate-fadeUpBlur">Cuenta</h2>

      {/* Avatar */}
      <div className="flex items-center gap-4">
        {user.picture ? (
          <img
            src={user.picture}
            alt={user.name}
            className="size-14 rounded-full object-cover border border-border"
          />
        ) : (
          <div className="size-14 rounded-full bg-bg-elevated border border-border flex items-center justify-center">
            <UserCircle className="size-7 text-text-muted" />
          </div>
        )}
        <div>
          <p className="text-sm font-medium text-text">{user.name}</p>
          <button className="text-xs text-text-muted hover:text-text mt-0.5 transition-colors">
            Cambiar avatar
          </button>
        </div>
      </div>

      {/* Fields */}
      <div className="space-y-3">
        <SettingsField label="Nombre completo" value={user.name} />
        <SettingsField label="Usuario" value={user.name.toLowerCase().replace(/\s+/g, ".")} />
        <SettingsField label="Correo electrónico" value={user.email || "No configurado"} icon={Mail} />
      </div>

      {/* System */}
      <div className="border-t border-border pt-4 space-y-2">
        <p className="text-xs text-text-subtle uppercase font-medium tracking-wider mb-3">Sistema</p>

        <button className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-bg-surface transition-colors text-sm text-text-muted hover:text-text">
          Contáctanos
          <ChevronRight className="size-4" />
        </button>

        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-bg-surface transition-colors text-sm text-text-muted hover:text-text"
        >
          <LogOut className="size-4" />
          Cerrar sesión
        </button>

        <button className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-danger-soft transition-colors text-sm text-danger">
          <Trash2 className="size-4" />
          Eliminar cuenta
        </button>
      </div>
    </div>
  );
}

function SettingsField({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: typeof Mail;
}) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5 liquid-glass rounded-xl">
      <div className="flex items-center gap-2.5 min-w-0">
        {Icon && <Icon className="size-4 text-text-muted shrink-0" />}
        <div className="min-w-0">
          <p className="text-xs text-text-muted">{label}</p>
          <p className="text-sm text-text truncate">{value}</p>
        </div>
      </div>
      <button className="text-xs text-text-muted hover:text-text transition-colors shrink-0 ml-3">
        Cambiar
      </button>
    </div>
  );
}

/* ─── Preferences ─── */

function PreferencesSection({
  theme,
  onToggleTheme,
}: {
  theme: "dark" | "light";
  onToggleTheme: () => void;
}) {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-medium text-text font-display">Preferencias</h2>

      <div className="space-y-4">
        <div>
          <p className="text-sm font-medium text-text mb-3">Tema</p>
          <div className="flex gap-3">
            {(["dark", "light"] as const).map((t) => (
              <button
                key={t}
                onClick={() => {
                  if (t !== theme) onToggleTheme();
                }}
                className={`flex-1 py-3 rounded-lg border text-sm font-medium transition-colors ${
                  theme === t
                    ? "bg-bg-surface border-text-muted/30 text-text"
                    : "border-border text-text-muted hover:text-text hover:border-text-muted/20"
                }`}
              >
                {t === "dark" ? "Oscuro" : "Claro"}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Coming Soon ─── */

function ComingSoon({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-text-muted">
      <p className="text-lg font-medium text-text mb-1 font-display">{label}</p>
      <p className="text-sm">Próximamente</p>
    </div>
  );
}
