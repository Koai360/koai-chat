import { useState, useEffect, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User as UserIcon,
  Palette,
  Mic,
  Bell,
  Brain,
  BookOpen,
  Wrench,
  LogOut,
  ChevronRight,
} from "lucide-react";
import type { AuthUser, UserMemory } from "@/types/api";
import { listMemories, deleteMemory } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { Skeleton } from "@/components/ui/Skeleton";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";

interface SettingsPageProps {
  user: AuthUser;
  tab?: string;
  onLogout: () => void;
}

const TABS: Array<{ id: string; label: string; icon: ReactNode }> = [
  { id: "cuenta", label: "Cuenta", icon: <UserIcon className="size-4" /> },
  { id: "tema", label: "Apariencia", icon: <Palette className="size-4" /> },
  { id: "voz", label: "Voz", icon: <Mic className="size-4" /> },
  { id: "notificaciones", label: "Notificaciones", icon: <Bell className="size-4" /> },
  { id: "memoria", label: "Memoria", icon: <Brain className="size-4" /> },
  { id: "kb", label: "Conocimiento", icon: <BookOpen className="size-4" /> },
  { id: "tools", label: "Herramientas", icon: <Wrench className="size-4" /> },
];

export function SettingsPage({ user, tab, onLogout }: SettingsPageProps) {
  const activeTab = tab && TABS.some((t) => t.id === tab) ? tab : "cuenta";

  return (
    <div className="h-full flex flex-col">
      <header className="px-6 pt-6 pb-3">
        <h1 className="display text-[24px] md:text-[28px] font-semibold text-white mb-1">
          Configuración
        </h1>
        <p className="text-sm text-white/45">Personalizá tu experiencia con Noa</p>
      </header>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Tab nav */}
        <nav className="md:w-60 shrink-0 px-3 md:px-6 pt-2 md:pt-4 md:pr-2 overflow-x-auto md:overflow-y-auto md:border-r border-white/[0.04]">
          <div className="flex md:flex-col gap-1 pb-3 md:pb-6">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  window.location.hash = `#/config/${t.id}`;
                }}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition",
                  activeTab === t.id
                    ? "bg-white/[0.06] text-white"
                    : "text-white/65 hover:bg-white/[0.04] hover:text-white",
                )}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </nav>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 md:py-6">
          <div className="max-w-2xl">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
              >
                {activeTab === "cuenta" && <AccountTab user={user} onLogout={onLogout} />}
                {activeTab === "tema" && <ThemeTab />}
                {activeTab === "voz" && <VoiceTab />}
                {activeTab === "notificaciones" && <NotificationsTab />}
                {activeTab === "memoria" && <MemoryTab />}
                {activeTab === "kb" && <KbTab />}
                {activeTab === "tools" && <ToolsTab />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Tabs
// ============================================================================

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-[15px] font-medium text-white mb-1">{title}</h2>
      {description && <p className="text-[13px] text-white/45 mb-3">{description}</p>}
      <div className="card-glass p-4">{children}</div>
    </section>
  );
}

function AccountTab({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  return (
    <>
      <Section title="Perfil">
        <div className="flex items-center gap-4">
          {user.picture ? (
            <img
              src={user.picture}
              alt={user.name}
              className="size-14 rounded-full object-cover ring-1 ring-white/10"
            />
          ) : (
            <div className="size-14 rounded-full bg-white/[0.08] flex items-center justify-center">
              <UserIcon className="size-6 text-white/70" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-white font-medium">{user.name}</p>
            <p className="text-[13px] text-white/55 truncate">{user.email}</p>
          </div>
        </div>
      </Section>

      <Section title="Sesión">
        <Button
          variant="danger"
          size="md"
          leadingIcon={<LogOut className="size-4" />}
          onClick={onLogout}
        >
          Cerrar sesión
        </Button>
      </Section>
    </>
  );
}

function ThemeTab() {
  return (
    <Section title="Apariencia" description="Modo oscuro siempre activo (light mode próximamente).">
      <div className="flex items-center gap-3">
        <div className="size-12 rounded-lg bg-[#000000] border border-white/10" />
        <div>
          <p className="text-white text-[14px] font-medium">Premium Dark</p>
          <p className="text-[12px] text-white/45">Activo</p>
        </div>
      </div>
    </Section>
  );
}

function VoiceTab() {
  return (
    <Section title="Voz" description="Configurá el modo voz de Noa (Deepgram + Whisper).">
      <p className="text-sm text-white/65">
        Hold-to-talk activo en el botón micrófono del input. Tap simple abre el modo voz fullscreen.
      </p>
    </Section>
  );
}

function NotificationsTab() {
  const [permission, setPermission] = useState<NotificationPermission | "default">(
    typeof Notification !== "undefined" ? Notification.permission : "default",
  );

  const request = async () => {
    if (typeof Notification === "undefined") return;
    const perm = await Notification.requestPermission();
    setPermission(perm);
  };

  return (
    <Section title="Notificaciones push" description="Recibí alertas críticas en tu dispositivo (CFO + Cal.com + Meta).">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-white text-[14px]">Estado:</p>
          <p className="text-[12px] text-white/55">
            {permission === "granted" ? "Activadas" : permission === "denied" ? "Bloqueadas" : "Sin configurar"}
          </p>
        </div>
        {permission !== "granted" && (
          <Button variant="primary" size="sm" onClick={request}>
            Activar
          </Button>
        )}
      </div>
    </Section>
  );
}

function MemoryTab() {
  const [memories, setMemories] = useState<UserMemory[] | null>(null);

  useEffect(() => {
    listMemories()
      .then(setMemories)
      .catch(() => setMemories([]));
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("¿Borrar esta memoria?")) return;
    try {
      await deleteMemory(id);
      setMemories((prev) => prev?.filter((m) => m.id !== id) ?? null);
    } catch (err) {
      console.warn("[MemoryTab] delete failed", err);
    }
  };

  return (
    <Section title="Memoria semántica" description="Lo que Noa recuerda sobre vos para personalizar respuestas.">
      {memories === null ? (
        <div className="space-y-2">
          <Skeleton variant="rect" height={48} />
          <Skeleton variant="rect" height={48} />
          <Skeleton variant="rect" height={48} />
        </div>
      ) : memories.length === 0 ? (
        <p className="text-sm text-white/55">Sin memorias guardadas aún.</p>
      ) : (
        <div className="space-y-2">
          {memories.map((m) => (
            <div
              key={m.id}
              className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/[0.04]"
            >
              <Pill tone="noa" size="sm">
                {m.type}
              </Pill>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] text-white/95">{m.content}</p>
                <p className="text-[12px] text-white/40 mt-1">{relativeTime(m.created_at)}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(m.id)}
              >
                Borrar
              </Button>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

function KbTab() {
  return (
    <Section title="Conocimiento (KB Manager)" description="Documentos y referencias indexadas para Noa.">
      <p className="text-sm text-white/55">
        Próximamente — accederás aquí a tu knowledge base.
      </p>
      <Button variant="secondary" size="sm" className="mt-3" trailingIcon={<ChevronRight className="size-4" />}>
        Abrir KB Manager
      </Button>
    </Section>
  );
}

function ToolsTab() {
  return (
    <Section title="Herramientas conectadas" description="Las ~100 tools del backend Noa activas.">
      <div className="space-y-2 text-[13px] text-white/75">
        <ToolRow name="KoaiHub" active />
        <ToolRow name="Plaid Production" active />
        <ToolRow name="Gmail + Calendar" active />
        <ToolRow name="respond.io" active />
        <ToolRow name="Cal.com" active />
        <ToolRow name="Modal StudioFlux" active />
        <ToolRow name="OpenAI Realtime (Translate)" active />
      </div>
    </Section>
  );
}

function ToolRow({ name, active }: { name: string; active: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span>{name}</span>
      <Pill tone={active ? "noa" : "neutral"} size="sm">
        {active ? "Conectado" : "Inactivo"}
      </Pill>
    </div>
  );
}
