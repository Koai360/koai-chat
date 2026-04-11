import { useState, useRef, useCallback, useEffect } from "react";
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
  EyeOff,
  Lock,
  Loader2,
  Check,
  KeyRound,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { usePrivateMode } from "@/hooks/usePrivateMode";
import { fetchImageLikes, unlikeImage, type ImageLike } from "@/lib/api";
import { getCfTransformUrl } from "@/lib/cfTransform";
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
  | "style"
  | "notifications"
  | "integrations"
  | "subscription"
  | "data"
  | "security";

const NAV_ITEMS: { id: Section; label: string; icon: typeof UserCircle }[] = [
  { id: "account", label: "Cuenta", icon: UserCircle },
  { id: "preferences", label: "Preferencias", icon: SlidersHorizontal },
  { id: "personalization", label: "Personalización", icon: Paintbrush },
  { id: "style", label: "Estilo IA", icon: Sparkles },
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

      {/* Mobile: Top tabs (horizontal scroll con fade indicator derecho) */}
      <div className="md:hidden relative shrink-0 border-b border-border bg-bg z-10">
        <div className="flex overflow-x-auto no-scrollbar px-2 py-1.5 gap-1">
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
        {/* Fade indicator: sugiere que hay más secciones a la derecha */}
        <div
          aria-hidden
          className="absolute top-0 right-0 bottom-0 w-8 pointer-events-none"
          style={{
            background: "linear-gradient(to right, transparent, var(--color-bg) 80%)",
          }}
        />
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
          {activeSection === "security" && <SecuritySection />}
          {activeSection === "style" && <StyleSection />}
          {activeSection !== "account" && activeSection !== "preferences" && activeSection !== "security" && activeSection !== "style" && (
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

/* ─── Estilo IA (image likes + futuro LoRA) ─── */

const LORA_TARGET = 30;

function StyleSection() {
  const [likes, setLikes] = useState<ImageLike[]>([]);
  const [likesCount, setLikesCount] = useState(0);
  const [dislikesCount, setDislikesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetchImageLikes({ limit: 50 });
      setLikes(resp.items);
      setLikesCount(resp.likes_count);
      setDislikesCount(resp.dislikes_count);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Listen for rate changes from ImageViewer
  useEffect(() => {
    const handler = () => load();
    window.addEventListener("image-rated", handler);
    return () => window.removeEventListener("image-rated", handler);
  }, [load]);

  const handleRemove = async (messageId: string) => {
    try {
      await unlikeImage(messageId);
      setLikes((prev) => prev.filter((l) => l.message_id !== messageId));
      // Reload counts
      const resp = await fetchImageLikes({ limit: 50 });
      setLikesCount(resp.likes_count);
      setDislikesCount(resp.dislikes_count);
    } catch (err) {
      console.error("[StyleSection] unlike failed:", err);
    }
  };

  const onlyLikes = likes.filter((l) => l.rating === 1);
  const progress = Math.min(100, Math.round((likesCount / LORA_TARGET) * 100));
  const remaining = Math.max(0, LORA_TARGET - likesCount);
  const loraReady = likesCount >= LORA_TARGET;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-medium text-text font-display animate-fadeUpBlur">
          Estilo IA
        </h2>
        <p className="text-xs text-text-muted mt-1">
          Noa aprende de las imágenes que te gustan. Cuando llegues a {LORA_TARGET} likes,
          podrás entrenar un LoRA custom con tu estilo.
        </p>
      </div>

      {/* Progress card */}
      <div className="liquid-glass rounded-2xl p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-kira/10 flex items-center justify-center shrink-0">
            <Sparkles className="size-5 text-kira" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-text">
              {loraReady ? "LoRA listo para entrenar" : "Progreso hacia tu LoRA"}
            </h3>
            <p className="text-xs text-text-muted mt-0.5">
              {loraReady
                ? `Tienes ${likesCount} imágenes likeadas — suficiente para entrenar`
                : `${likesCount} / ${LORA_TARGET} imágenes · faltan ${remaining}`}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="relative h-2 rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${progress}%`,
              background: loraReady
                ? "linear-gradient(90deg, #D4E94B 0%, #A8D830 100%)"
                : "linear-gradient(90deg, #D4E94B 0%, rgba(212,233,75,0.6) 100%)",
              boxShadow: "0 0 12px rgba(212, 233, 75, 0.3)",
            }}
          />
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <ThumbsUp className="size-3.5 text-kira" />
            <span className="text-text-muted">
              <span className="text-text font-medium">{likesCount}</span> likes
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <ThumbsDown className="size-3.5 text-danger" />
            <span className="text-text-muted">
              <span className="text-text font-medium">{dislikesCount}</span> descartes
            </span>
          </div>
        </div>

        {/* Train button — activo solo cuando >= LORA_TARGET */}
        <button
          disabled={!loraReady}
          className="w-full py-2.5 rounded-xl text-sm font-medium transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            backgroundColor: loraReady ? "#D4E94B" : "rgba(255,255,255,0.05)",
            color: loraReady ? "#0a0a0c" : "rgba(255,255,255,0.4)",
            boxShadow: loraReady ? "0 0 20px rgba(212, 233, 75, 0.35)" : "none",
          }}
        >
          {loraReady ? "Entrenar mi LoRA" : `Bloqueado (${remaining} likes faltantes)`}
        </button>
      </div>

      {/* Grid de likes */}
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="size-5 animate-spin text-text-muted" />
        </div>
      ) : error ? (
        <div className="text-center py-10 text-text-muted">
          <p className="text-sm text-danger">{error}</p>
          <button onClick={load} className="mt-3 text-xs text-kira hover:underline">
            Reintentar
          </button>
        </div>
      ) : onlyLikes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-text-muted">
          <ThumbsUp className="size-10 mb-3 opacity-30" />
          <p className="text-sm">Aún no has likeado ninguna imagen</p>
          <p className="text-xs text-text-subtle mt-1 max-w-[280px] text-center">
            Abre cualquier imagen en la galería o chat y dale 👍 para guardar su estilo
          </p>
        </div>
      ) : (
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-subtle mb-2 px-1">
            Últimas likeadas
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {onlyLikes.slice(0, 24).map((like) => (
              <div
                key={like.id}
                className="relative aspect-square rounded-lg overflow-hidden bg-bg-surface border border-border group"
              >
                {like.image_url && (
                  <img
                    src={getCfTransformUrl(like.image_url, "thumb")}
                    alt={like.prompt || "Liked"}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                )}
                <button
                  onClick={() => handleRemove(like.message_id)}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 backdrop-blur-sm text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center active:opacity-100"
                  aria-label="Quitar like"
                >
                  <ThumbsDown className="size-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


/* ─── Security ─── */

type PinStep = "idle" | "setup" | "verify" | "change-old" | "change-new";

function SecuritySection() {
  const { hasPin, isUnlocked, unlock, lock, setPin } = usePrivateMode();
  const [pinStep, setPinStep] = useState<PinStep>("idle");
  const [pinValue, setPinValue] = useState("");
  const [oldPinValue, setOldPinValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const resetState = useCallback(() => {
    setPinStep("idle");
    setPinValue("");
    setOldPinValue("");
    setError(null);
    setBusy(false);
    setSuccess(false);
  }, []);

  // Handle PIN digit input
  const handleDigit = useCallback(
    (index: number, value: string, setter: (v: string) => void, currentVal: string) => {
      if (!/^\d?$/.test(value)) return;
      const digits = currentVal.split("");
      digits[index] = value;
      const newVal = digits.join("");
      setter(newVal.slice(0, 4));

      // Auto-focus next
      if (value && index < 3) {
        inputRefs.current[index + 1]?.focus();
      }
    },
    [],
  );

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent, currentVal: string, setter: (v: string) => void) => {
      if (e.key === "Backspace" && !currentVal[index] && index > 0) {
        const digits = currentVal.split("");
        digits[index - 1] = "";
        setter(digits.join(""));
        inputRefs.current[index - 1]?.focus();
      }
    },
    [],
  );

  // Setup new PIN
  const handleSetup = useCallback(async () => {
    if (pinValue.length !== 4) return;
    setBusy(true);
    setError(null);
    try {
      await setPin(pinValue);
      setSuccess(true);
      setTimeout(resetState, 1500);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }, [pinValue, setPin, resetState]);

  // Verify PIN to unlock
  const handleVerify = useCallback(async () => {
    if (pinValue.length !== 4) return;
    setBusy(true);
    setError(null);
    try {
      const ok = await unlock(pinValue);
      if (ok) {
        setSuccess(true);
        setTimeout(resetState, 1000);
      } else {
        setError("PIN incorrecto");
        setPinValue("");
        inputRefs.current[0]?.focus();
      }
    } catch {
      setError("Error al verificar");
    } finally {
      setBusy(false);
    }
  }, [pinValue, unlock, resetState]);

  // Change PIN — step 1: verify old
  const handleChangeOld = useCallback(async () => {
    if (oldPinValue.length !== 4) return;
    // Just move to next step — actual verification happens on submit
    setPinStep("change-new");
    setPinValue("");
    setTimeout(() => inputRefs.current[0]?.focus(), 100);
  }, [oldPinValue]);

  // Change PIN — step 2: set new
  const handleChangeNew = useCallback(async () => {
    if (pinValue.length !== 4) return;
    setBusy(true);
    setError(null);
    try {
      await setPin(pinValue, oldPinValue);
      setSuccess(true);
      setTimeout(resetState, 1500);
    } catch (err) {
      setError((err as Error).message);
      // Go back to old PIN step
      setPinStep("change-old");
      setOldPinValue("");
      setPinValue("");
    } finally {
      setBusy(false);
    }
  }, [pinValue, oldPinValue, setPin, resetState]);

  // Auto-submit when 4 digits entered
  useEffect(() => {
    if (pinValue.length === 4 && !busy) {
      if (pinStep === "setup") handleSetup();
      else if (pinStep === "verify") handleVerify();
      else if (pinStep === "change-new") handleChangeNew();
    }
  }, [pinValue, pinStep, busy, handleSetup, handleVerify, handleChangeNew]);

  useEffect(() => {
    if (oldPinValue.length === 4 && pinStep === "change-old" && !busy) {
      handleChangeOld();
    }
  }, [oldPinValue, pinStep, busy, handleChangeOld]);

  const handleToggle = useCallback(
    (checked: boolean) => {
      if (!checked) {
        // Turning OFF (locking) — instant
        lock();
      } else {
        // Turning ON (unlocking) — needs PIN
        setPinStep("verify");
        setPinValue("");
        setError(null);
        setTimeout(() => inputRefs.current[0]?.focus(), 100);
      }
    },
    [lock],
  );

  const renderPinInput = (value: string, setter: (v: string) => void) => (
    <div className="flex gap-3 justify-center my-4">
      {[0, 1, 2, 3].map((i) => (
        <input
          key={i}
          ref={(el) => { inputRefs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          value={value[i] || ""}
          onChange={(e) => handleDigit(i, e.target.value, setter, value)}
          onKeyDown={(e) => handleKeyDown(i, e, value, setter)}
          className="w-12 h-14 text-center text-xl font-mono font-bold rounded-xl bg-bg-elevated border border-border text-text focus:border-kira focus:ring-1 focus:ring-kira/30 outline-none transition-all"
          autoComplete="off"
        />
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-medium text-text font-display animate-fadeUpBlur">
        Seguridad
      </h2>

      {/* Private Gallery Card */}
      <div className="liquid-glass rounded-2xl p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-kira/10 flex items-center justify-center shrink-0">
            <EyeOff className="size-5 text-kira" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-text">Galería Privada</h3>
            <p className="text-xs text-text-muted mt-0.5">
              Oculta imágenes de la galería principal. Solo visibles con tu PIN.
            </p>
          </div>
        </div>

        {!hasPin ? (
          /* No PIN configured yet */
          <div className="space-y-3">
            {pinStep !== "setup" ? (
              <button
                onClick={() => {
                  setPinStep("setup");
                  setPinValue("");
                  setTimeout(() => inputRefs.current[0]?.focus(), 100);
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-kira/10 hover:bg-kira/20 text-kira text-sm font-medium transition-colors"
              >
                <KeyRound className="size-4" />
                Configurar PIN
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-text-muted text-center">
                  Crea un PIN de 4 dígitos
                </p>
                {renderPinInput(pinValue, setPinValue)}
                {error && (
                  <p className="text-xs text-danger text-center">{error}</p>
                )}
                {success && (
                  <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-400">
                    <Check className="size-3.5" />
                    PIN configurado
                  </div>
                )}
                {busy && (
                  <div className="flex justify-center">
                    <Loader2 className="size-4 animate-spin text-kira" />
                  </div>
                )}
                <button
                  onClick={resetState}
                  className="text-xs text-text-muted hover:text-text mx-auto block"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        ) : (
          /* PIN exists — show toggle + change option */
          <div className="space-y-4">
            {/* Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="size-4 text-text-muted" />
                <span className="text-sm text-text">
                  {isUnlocked ? "Desbloqueada" : "Bloqueada"}
                </span>
              </div>
              <Switch
                checked={isUnlocked}
                onCheckedChange={handleToggle}
              />
            </div>

            {/* PIN verify dialog (inline) */}
            {pinStep === "verify" && (
              <div className="space-y-2 pt-2 border-t border-border">
                <p className="text-xs text-text-muted text-center">
                  Ingresa tu PIN para desbloquear
                </p>
                {renderPinInput(pinValue, setPinValue)}
                {error && (
                  <p className="text-xs text-danger text-center animate-shake">{error}</p>
                )}
                {success && (
                  <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-400">
                    <Check className="size-3.5" />
                    Desbloqueada
                  </div>
                )}
                {busy && (
                  <div className="flex justify-center">
                    <Loader2 className="size-4 animate-spin text-kira" />
                  </div>
                )}
                <button
                  onClick={resetState}
                  className="text-xs text-text-muted hover:text-text mx-auto block"
                >
                  Cancelar
                </button>
              </div>
            )}

            {/* Change PIN */}
            {pinStep === "idle" && (
              <button
                onClick={() => {
                  setPinStep("change-old");
                  setOldPinValue("");
                  setPinValue("");
                  setError(null);
                  setTimeout(() => inputRefs.current[0]?.focus(), 100);
                }}
                className="text-xs text-text-muted hover:text-text transition-colors"
              >
                Cambiar PIN
              </button>
            )}

            {pinStep === "change-old" && (
              <div className="space-y-2 pt-2 border-t border-border">
                <p className="text-xs text-text-muted text-center">
                  Ingresa tu PIN actual
                </p>
                {renderPinInput(oldPinValue, setOldPinValue)}
                {error && (
                  <p className="text-xs text-danger text-center">{error}</p>
                )}
                <button
                  onClick={resetState}
                  className="text-xs text-text-muted hover:text-text mx-auto block"
                >
                  Cancelar
                </button>
              </div>
            )}

            {pinStep === "change-new" && (
              <div className="space-y-2 pt-2 border-t border-border">
                <p className="text-xs text-text-muted text-center">
                  Ingresa tu nuevo PIN
                </p>
                {renderPinInput(pinValue, setPinValue)}
                {error && (
                  <p className="text-xs text-danger text-center">{error}</p>
                )}
                {success && (
                  <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-400">
                    <Check className="size-3.5" />
                    PIN actualizado
                  </div>
                )}
                {busy && (
                  <div className="flex justify-center">
                    <Loader2 className="size-4 animate-spin text-kira" />
                  </div>
                )}
                <button
                  onClick={resetState}
                  className="text-xs text-text-muted hover:text-text mx-auto block"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        )}
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
