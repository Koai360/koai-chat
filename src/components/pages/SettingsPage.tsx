import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
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
  ChevronLeft,
  ChevronRight,
  Lock,
  Shield,
  EyeOff,
  KeyRound,
  Check,
  Loader2,
} from "lucide-react";
import type { AuthUser, UserMemory } from "@/types/api";
import { listMemories, deleteMemory } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { Skeleton } from "@/components/ui/Skeleton";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { usePrivateMode } from "@/hooks/usePrivateMode";

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
  { id: "privacidad", label: "Privacidad", icon: <Shield className="size-4" /> },
  { id: "memoria", label: "Memoria", icon: <Brain className="size-4" /> },
  { id: "kb", label: "Conocimiento", icon: <BookOpen className="size-4" /> },
  { id: "tools", label: "Herramientas", icon: <Wrench className="size-4" /> },
];

/** md breakpoint reactivo — decide entre lista mobile y sidebar desktop */
function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(mq.matches);
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isDesktop;
}

export function SettingsPage({ user, tab, onLogout }: SettingsPageProps) {
  const isDesktop = useIsDesktop();
  const validTab = tab && TABS.some((t) => t.id === tab) ? tab : undefined;
  const activeTab = validTab ?? "cuenta";

  const renderTab = (id: string) => (
    <>
      {id === "cuenta" && <AccountTab user={user} onLogout={onLogout} />}
      {id === "tema" && <ThemeTab />}
      {id === "voz" && <VoiceTab />}
      {id === "notificaciones" && <NotificationsTab />}
      {id === "privacidad" && <PrivacyTab />}
      {id === "memoria" && <MemoryTab />}
      {id === "kb" && <KbTab />}
      {id === "tools" && <ToolsTab />}
    </>
  );

  // ── Mobile (S161): los 8 tabs en scroll horizontal eran inutilizables en
  // touch — ahora lista estilo iOS → sub-página con "volver" ──
  if (!isDesktop) {
    if (!validTab) {
      return (
        <div className="h-full overflow-y-auto">
          <header className="px-5 pt-6 pb-4">
            <h1 className="display text-[24px] font-semibold text-white mb-1">
              Configuración
            </h1>
            <p className="text-sm text-white/45">Personalizá tu experiencia con Noa</p>
          </header>
          <nav className="px-3 pb-8">
            <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] divide-y divide-white/[0.05] overflow-hidden">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    window.location.hash = `#/config/${t.id}`;
                  }}
                  className="w-full flex items-center gap-3.5 px-4 py-3.5 text-left active:bg-white/[0.06] transition-colors"
                >
                  <span className="size-8 rounded-lg bg-white/[0.06] flex items-center justify-center text-white/80 shrink-0">
                    {t.icon}
                  </span>
                  <span className="flex-1 text-[15px] text-white/90">{t.label}</span>
                  <ChevronRight className="size-4 text-white/30 shrink-0" />
                </button>
              ))}
            </div>
          </nav>
        </div>
      );
    }

    const current = TABS.find((t) => t.id === validTab)!;
    return (
      <div className="h-full flex flex-col">
        <header className="px-3 pt-4 pb-2 shrink-0">
          <button
            onClick={() => {
              window.location.hash = "#/config";
            }}
            className="flex items-center gap-1 text-[15px] text-white/70 active:text-white py-1.5 pr-3"
          >
            <ChevronLeft className="size-5" />
            Configuración
          </button>
          <h1 className="display text-[22px] font-semibold text-white px-1.5 pt-1">
            {current.label}
          </h1>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-3">
          <motion.div
            key={validTab}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.18 }}
          >
            {renderTab(validTab)}
          </motion.div>
        </div>
      </div>
    );
  }

  // ── Desktop: sidebar + contenido ──
  return (
    <div className="h-full flex flex-col">
      <header className="px-6 pt-6 pb-3">
        <h1 className="display text-[24px] md:text-[28px] font-semibold text-white mb-1">
          Configuración
        </h1>
        <p className="text-sm text-white/45">Personalizá tu experiencia con Noa</p>
      </header>

      <div className="flex-1 flex flex-row overflow-hidden">
        {/* Tab nav */}
        <nav className="w-60 shrink-0 px-6 pt-4 pr-2 overflow-y-auto border-r border-white/[0.04]">
          <div className="flex flex-col gap-1 pb-6">
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
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="max-w-2xl">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
              >
                {renderTab(activeTab)}
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
      {/* S158-b: botón sin onClick parecía habilitado y no hacía nada —
          deshabilitado honesto hasta que exista la feature */}
      <Button variant="secondary" size="sm" className="mt-3 opacity-50 cursor-not-allowed" disabled trailingIcon={<ChevronRight className="size-4" />}>
        Próximamente
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

// ============================================================================
// Privacy tab — Galería privada con PIN
// ============================================================================

type PinStep = "idle" | "setup" | "verify" | "change-old" | "change-new";

function PrivacyTab() {
  const { hasPin, isUnlocked, loading, unlock, lock, setPin } = usePrivateMode();
  const [step, setStep] = useState<PinStep>("idle");
  const [pinValue, setPinValue] = useState("");
  const [oldPinValue, setOldPinValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const reset = useCallback(() => {
    setStep("idle");
    setPinValue("");
    setOldPinValue("");
    setError(null);
    setBusy(false);
    setSuccess(false);
  }, []);

  const handleDigit = (
    index: number,
    value: string,
    setter: (v: string) => void,
    current: string,
  ) => {
    if (!/^\d?$/.test(value)) return;
    const digits = current.split("");
    digits[index] = value;
    setter(digits.join("").slice(0, 4));
    if (value && index < 3) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent,
    current: string,
    setter: (v: string) => void,
  ) => {
    if (e.key === "Backspace" && !current[index] && index > 0) {
      const digits = current.split("");
      digits[index - 1] = "";
      setter(digits.join(""));
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSetup = useCallback(async () => {
    if (pinValue.length !== 4) return;
    setBusy(true);
    setError(null);
    try {
      await setPin(pinValue);
      setSuccess(true);
      setTimeout(reset, 1500);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }, [pinValue, setPin, reset]);

  const handleVerify = useCallback(async () => {
    if (pinValue.length !== 4) return;
    setBusy(true);
    setError(null);
    try {
      const ok = await unlock(pinValue);
      if (ok) {
        setSuccess(true);
        setTimeout(reset, 1000);
      } else {
        setError("PIN incorrecto");
        setPinValue("");
        inputRefs.current[0]?.focus();
      }
    } catch (err) {
      // S158-b: 429 = bloqueo temporal por intentos — mostrar el tiempo real
      // del backend en vez de un genérico
      const apiErr = err as { status?: number; message?: string };
      if (apiErr?.status === 429 && apiErr.message) {
        setError(apiErr.message);
      } else {
        setError("Error al verificar");
      }
      setPinValue("");
    } finally {
      setBusy(false);
    }
  }, [pinValue, unlock, reset]);

  const handleChangeOld = useCallback(() => {
    if (oldPinValue.length !== 4) return;
    setStep("change-new");
    setPinValue("");
    setTimeout(() => inputRefs.current[0]?.focus(), 100);
  }, [oldPinValue]);

  const handleChangeNew = useCallback(async () => {
    if (pinValue.length !== 4) return;
    setBusy(true);
    setError(null);
    try {
      await setPin(pinValue, oldPinValue);
      setSuccess(true);
      setTimeout(reset, 1500);
    } catch (err) {
      setError((err as Error).message);
      setStep("change-old");
      setOldPinValue("");
      setPinValue("");
    } finally {
      setBusy(false);
    }
  }, [pinValue, oldPinValue, setPin, reset]);

  useEffect(() => {
    if (pinValue.length === 4 && !busy) {
      if (step === "setup") handleSetup();
      else if (step === "verify") handleVerify();
      else if (step === "change-new") handleChangeNew();
    }
  }, [pinValue, step, busy, handleSetup, handleVerify, handleChangeNew]);

  useEffect(() => {
    if (oldPinValue.length === 4 && step === "change-old" && !busy) {
      handleChangeOld();
    }
  }, [oldPinValue, step, busy, handleChangeOld]);

  const renderPin = (value: string, setter: (v: string) => void) => (
    <div className="flex gap-3 justify-center my-4">
      {[0, 1, 2, 3].map((i) => (
        <input
          key={i}
          ref={(el) => {
            inputRefs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          value={value[i] || ""}
          onChange={(e) => handleDigit(i, e.target.value, setter, value)}
          onKeyDown={(e) => handleKeyDown(i, e, value, setter)}
          className="w-12 h-14 text-center text-xl font-medium rounded-xl bg-[var(--color-bg-input)] border border-[var(--color-border)] text-white focus:border-[var(--color-noa)] focus:ring-2 focus:ring-[var(--color-noa)]/30 outline-none transition mono"
          autoComplete="off"
        />
      ))}
    </div>
  );

  return (
    <>
      <Section
        title="Galería privada"
        description="Imágenes ocultas detrás de un PIN de 4 dígitos. Solo se ven cuando desbloqueás la sesión."
      >
        <div className="flex items-start gap-3">
          <div className="size-10 rounded-xl bg-[var(--color-noa-soft)] flex items-center justify-center shrink-0">
            <EyeOff className="size-5 text-[var(--color-noa)]" />
          </div>
          <div className="flex-1 min-w-0">
            {loading ? (
              <Skeleton variant="rect" height={20} width={140} />
            ) : !hasPin ? (
              <p className="text-[13px] text-white/65">Aún no tenés PIN configurado.</p>
            ) : (
              <p className="text-[13px] text-white/65">
                Estado: <span className="text-white font-medium">{isUnlocked ? "Desbloqueada" : "Bloqueada"}</span>
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {!hasPin && step !== "setup" && (
            <Button
              variant="primary"
              size="md"
              leadingIcon={<KeyRound className="size-4" />}
              onClick={() => {
                setStep("setup");
                setPinValue("");
                setError(null);
                setTimeout(() => inputRefs.current[0]?.focus(), 100);
              }}
            >
              Configurar PIN
            </Button>
          )}

          {step === "setup" && (
            <div className="space-y-2">
              <p className="text-[12px] text-white/55 text-center">Creá un PIN de 4 dígitos</p>
              {renderPin(pinValue, setPinValue)}
              {error && <p className="text-[12px] text-[var(--color-danger)] text-center">{error}</p>}
              {success && (
                <div className="flex items-center justify-center gap-1.5 text-[12px] text-emerald-400">
                  <Check className="size-3.5" /> PIN configurado
                </div>
              )}
              {busy && (
                <div className="flex justify-center">
                  <Loader2 className="size-4 animate-spin text-[var(--color-noa)]" />
                </div>
              )}
              <button onClick={reset} className="block mx-auto text-[12px] text-white/55 hover:text-white">
                Cancelar
              </button>
            </div>
          )}

          {hasPin && step === "idle" && (
            <div className="flex flex-wrap gap-2">
              {isUnlocked ? (
                <Button variant="secondary" size="md" leadingIcon={<Lock className="size-4" />} onClick={lock}>
                  Bloquear
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="md"
                  leadingIcon={<KeyRound className="size-4" />}
                  onClick={() => {
                    setStep("verify");
                    setPinValue("");
                    setError(null);
                    setTimeout(() => inputRefs.current[0]?.focus(), 100);
                  }}
                >
                  Desbloquear
                </Button>
              )}
              <Button
                variant="ghost"
                size="md"
                onClick={() => {
                  setStep("change-old");
                  setOldPinValue("");
                  setPinValue("");
                  setError(null);
                  setTimeout(() => inputRefs.current[0]?.focus(), 100);
                }}
              >
                Cambiar PIN
              </Button>
            </div>
          )}

          {step === "verify" && (
            <div className="space-y-2 pt-2 border-t border-white/[0.06]">
              <p className="text-[12px] text-white/55 text-center">Ingresá tu PIN para desbloquear</p>
              {renderPin(pinValue, setPinValue)}
              {error && <p className="text-[12px] text-[var(--color-danger)] text-center">{error}</p>}
              {success && (
                <div className="flex items-center justify-center gap-1.5 text-[12px] text-emerald-400">
                  <Check className="size-3.5" /> Desbloqueada
                </div>
              )}
              {busy && (
                <div className="flex justify-center">
                  <Loader2 className="size-4 animate-spin text-[var(--color-noa)]" />
                </div>
              )}
              <button onClick={reset} className="block mx-auto text-[12px] text-white/55 hover:text-white">
                Cancelar
              </button>
            </div>
          )}

          {step === "change-old" && (
            <div className="space-y-2 pt-2 border-t border-white/[0.06]">
              <p className="text-[12px] text-white/55 text-center">Ingresá tu PIN actual</p>
              {renderPin(oldPinValue, setOldPinValue)}
              {error && <p className="text-[12px] text-[var(--color-danger)] text-center">{error}</p>}
              <button onClick={reset} className="block mx-auto text-[12px] text-white/55 hover:text-white">
                Cancelar
              </button>
            </div>
          )}

          {step === "change-new" && (
            <div className="space-y-2 pt-2 border-t border-white/[0.06]">
              <p className="text-[12px] text-white/55 text-center">Ingresá tu nuevo PIN</p>
              {renderPin(pinValue, setPinValue)}
              {error && <p className="text-[12px] text-[var(--color-danger)] text-center">{error}</p>}
              {success && (
                <div className="flex items-center justify-center gap-1.5 text-[12px] text-emerald-400">
                  <Check className="size-3.5" /> PIN actualizado
                </div>
              )}
              {busy && (
                <div className="flex justify-center">
                  <Loader2 className="size-4 animate-spin text-[var(--color-noa)]" />
                </div>
              )}
              <button onClick={reset} className="block mx-auto text-[12px] text-white/55 hover:text-white">
                Cancelar
              </button>
            </div>
          )}
        </div>
      </Section>

      <Section title="Cómo funciona">
        <ul className="text-[13px] text-white/65 space-y-1.5 list-disc list-inside">
          <li>Tocá <strong className="text-white font-medium">ocultar</strong> en cualquier imagen de la galería para moverla al espacio privado.</li>
          <li>Una vez desbloqueada en esta sesión, aparece una pestaña <strong className="text-white font-medium">Privadas</strong> en la galería.</li>
          <li>La sesión se bloquea al cerrar la app o al tap <strong className="text-white font-medium">Bloquear</strong>.</li>
          <li>3 intentos fallidos = 30s bloqueo · 5 = 5min · 8 = 1h · 10+ = 24h.</li>
        </ul>
      </Section>
    </>
  );
}
