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
import {
  fetchImageLikes,
  deleteLike,
  previewCivitai,
  importCivitai,
  STYLE_CATEGORIES,
  type ImageLike,
  type StyleCategory,
  type CivitaiPreview,
} from "@/lib/api";
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
  const [activeSection, setActiveSection] = useState<Section | null>(null);
  // En desktop siempre mostrar una sección; en mobile empieza sin sección (lista)
  const [isMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);

  // Desktop: si no hay sección activa, default a "account"
  const effectiveSection = activeSection ?? (isMobile ? null : "account");

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
                effectiveSection === item.id
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

      {/* Mobile: Lista vertical de secciones (estilo iOS Settings) */}
      {isMobile && effectiveSection === null && (
        <ScrollArea className="flex-1">
          <div className="px-4 pt-4 pb-2">
            <h1 className="text-xl font-display font-medium text-text mb-4">Ajustes</h1>
          </div>
          <div className="px-2 pb-4 space-y-0.5">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-bg-surface transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-bg-surface flex items-center justify-center shrink-0">
                    <Icon className="size-4 text-text-muted" />
                  </div>
                  <span className="flex-1 text-sm text-text">{item.label}</span>
                  <ChevronRight className="size-4 text-text-subtle" />
                </button>
              );
            })}
          </div>
        </ScrollArea>
      )}

      {/* Content — solo se muestra cuando hay sección activa */}
      {effectiveSection !== null && (
      <ScrollArea className="flex-1 h-full">
        {/* Mobile: botón volver */}
        {isMobile && (
          <button
            onClick={() => setActiveSection(null)}
            className="flex items-center gap-1 px-4 pt-4 pb-1 text-xs text-noa font-medium"
          >
            ← Ajustes
          </button>
        )}
        <div className="p-6 max-w-xl">
          {effectiveSection === "account" && (
            <AccountSection user={user} onLogout={onLogout} />
          )}
          {effectiveSection === "preferences" && (
            <PreferencesSection theme={theme} onToggleTheme={onToggleTheme} />
          )}
          {effectiveSection === "security" && <SecuritySection />}
          {effectiveSection === "style" && <StyleSection />}
          {effectiveSection !== "account" && effectiveSection !== "preferences" && effectiveSection !== "security" && effectiveSection !== "style" && (
            <ComingSoon label={NAV_ITEMS.find((n) => n.id === effectiveSection)?.label || ""} />
          )}
        </div>
      </ScrollArea>
      )}
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

/* ─── Estilo IA (image likes + Civitai imports + futuro LoRA) ─── */

const LORA_TARGET = 30;
type ActiveTab = "all" | StyleCategory;

function StyleSection() {
  const [likes, setLikes] = useState<ImageLike[]>([]);
  const [likesCount, setLikesCount] = useState(0);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("all");

  // Import Civitai state
  const [importUrl, setImportUrl] = useState("");
  const [preview, setPreview] = useState<CivitaiPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [importCategory, setImportCategory] = useState<StyleCategory>("anime");
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetchImageLikes({ limit: 100 });
      setLikes(resp.items);
      setLikesCount(resp.likes_count);
      setCategoryCounts(resp.category_counts || {});
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const handler = () => load();
    window.addEventListener("image-rated", handler);
    return () => window.removeEventListener("image-rated", handler);
  }, [load]);

  const handleRemove = async (likeId: string) => {
    try {
      await deleteLike(likeId);
      setLikes((prev) => prev.filter((l) => l.id !== likeId));
      load(); // refresh counts
    } catch (err) {
      console.error("[StyleSection] delete failed:", err);
    }
  };

  const handlePreview = async () => {
    const url = importUrl.trim();
    if (!url) return;
    setPreviewLoading(true);
    setImportError(null);
    setImportSuccess(false);
    setPreview(null);
    try {
      const p = await previewCivitai(url);
      setPreview(p);
      setImportCategory(p.suggested_category === "uncategorized" ? "anime" : p.suggested_category);
    } catch (err) {
      setImportError((err as Error).message);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!preview) return;
    setImportBusy(true);
    setImportError(null);
    try {
      await importCivitai(importUrl.trim(), importCategory);
      setImportSuccess(true);
      setPreview(null);
      setImportUrl("");
      load();
      setTimeout(() => setImportSuccess(false), 2500);
    } catch (err) {
      setImportError((err as Error).message);
    } finally {
      setImportBusy(false);
    }
  };

  const handleCancelPreview = () => {
    setPreview(null);
    setImportError(null);
  };

  const filteredLikes = likes.filter((l) => {
    if (l.rating < 1) return false;
    if (activeTab === "all") return true;
    return (l.category || "uncategorized") === activeTab;
  });

  const progress = Math.min(100, Math.round((likesCount / LORA_TARGET) * 100));
  const remaining = Math.max(0, LORA_TARGET - likesCount);
  const loraReady = likesCount >= LORA_TARGET;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-medium text-text font-display animate-fadeUpBlur">
          Estilo IA
        </h2>
        <p className="text-[11px] text-text-muted mt-1 leading-relaxed">
          Noa aprende de las imágenes que te gustan. Dale ⭐ a cualquier imagen del chat
          o importa de Civitai. Con {LORA_TARGET}+ imágenes, entrenas tu LoRA custom.
        </p>
      </div>

      {/* Progress — inline compacto */}
      <div className="rounded-xl border border-border p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="size-3.5 text-noa shrink-0" />
          <p className="text-[11px] text-text-muted flex-1">
            {loraReady
              ? `${likesCount} imágenes · LoRA listo 🎯`
              : `${likesCount}/${LORA_TARGET} — faltan ${remaining}`}
          </p>
        </div>
        <div className="relative h-1 rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
            style={{
              width: `${progress}%`,
              background: "#D4E94B",
              boxShadow: "0 0 8px rgba(212, 233, 75, 0.3)",
            }}
          />
        </div>
      </div>

      {/* Import Civitai */}
      <div className="rounded-xl border border-border p-3 space-y-2.5">
        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-text-subtle">
          Importar de Civitai
        </span>
        {!preview && (
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="url"
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handlePreview()}
              placeholder="https://civitai.com/images/..."
              className="flex-1 h-10 px-3 rounded-lg bg-bg-elevated border border-border text-text text-[13px] outline-none focus:border-noa focus:ring-1 focus:ring-noa/30 transition-all placeholder:text-text-subtle"
              disabled={previewLoading}
            />
            <button
              onClick={handlePreview}
              disabled={!importUrl.trim() || previewLoading}
              className="h-10 px-4 rounded-lg bg-noa text-[#0a0a0c] text-[13px] font-medium transition-all active:scale-[0.98] disabled:opacity-50 shrink-0"
            >
              {previewLoading ? <Loader2 className="size-4 animate-spin" /> : "Ver preview"}
            </button>
          </div>
        )}

        {/* Preview con params + selector de categoría */}
        {preview && (
          <div className="space-y-3">
            <div className="flex gap-3">
              <img
                src={preview.image_url}
                alt="Preview"
                className="w-20 h-28 sm:w-24 sm:h-36 object-cover rounded-lg border border-border shrink-0"
              />
              <div className="flex-1 min-w-0 space-y-1 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="text-text-subtle">Modelo:</span>
                  <span className="text-text font-medium truncate">
                    {preview.params.base_model || "Desconocido"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-text-subtle">Engine sugerido:</span>
                  <span className="text-noa font-mono">{preview.suggested_engine}</span>
                </div>
                {preview.params.cfg_scale !== undefined && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-text-subtle">CFG:</span>
                    <span className="text-text font-mono">{preview.params.cfg_scale}</span>
                  </div>
                )}
                {preview.params.sampler && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-text-subtle">Sampler:</span>
                    <span className="text-text font-mono truncate">{preview.params.sampler}</span>
                  </div>
                )}
                {preview.params.steps !== undefined && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-text-subtle">Steps:</span>
                    <span className="text-text font-mono">{preview.params.steps}</span>
                  </div>
                )}
                {(preview.params.loras?.length ?? 0) > 0 && (
                  <div className="flex items-start gap-1.5">
                    <span className="text-text-subtle shrink-0">LoRAs:</span>
                    <span className="text-text font-mono text-[10px] break-all">
                      {preview.params.loras!.map((l) => `${l.name}@${l.weight}`).join(", ")}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Category selector */}
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-text-subtle mb-1.5">
                Categoría — elige a cuál pertenece
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {STYLE_CATEGORIES.filter((c) => c.id !== "uncategorized").map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setImportCategory(cat.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[11px] font-medium transition-all ${
                      importCategory === cat.id
                        ? "bg-noa/15 border border-noa/60 text-text"
                        : "bg-bg-elevated border border-border text-text-muted hover:text-text"
                    }`}
                  >
                    <span>{cat.icon}</span>
                    <span className="truncate">{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleCancelPreview}
                disabled={importBusy}
                className="flex-1 h-10 rounded-lg border border-border text-text-muted hover:text-text text-sm font-medium transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={importBusy}
                className="flex-1 h-10 rounded-lg bg-noa text-[#0a0a0c] text-sm font-medium transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {importBusy ? (
                  <Loader2 className="size-4 animate-spin mx-auto" />
                ) : (
                  `Guardar en ${STYLE_CATEGORIES.find((c) => c.id === importCategory)?.label}`
                )}
              </button>
            </div>
          </div>
        )}

        {importError && (
          <p className="text-[11px] text-danger text-center">{importError}</p>
        )}
        {importSuccess && (
          <p className="text-[11px] text-emerald-400 text-center flex items-center justify-center gap-1">
            <Check className="size-3" /> Guardado en tu biblioteca
          </p>
        )}
      </div>

      {/* Tabs por categoría */}
      <div>
        <div className="flex gap-1 overflow-x-auto no-scrollbar pb-2">
          <TabButton
            active={activeTab === "all"}
            onClick={() => setActiveTab("all")}
            label="Todas"
            count={likesCount}
          />
          {STYLE_CATEGORIES.map((cat) => {
            const count = categoryCounts[cat.id] || 0;
            if (count === 0 && cat.id === "uncategorized") return null;
            return (
              <TabButton
                key={cat.id}
                active={activeTab === cat.id}
                onClick={() => setActiveTab(cat.id)}
                label={`${cat.icon} ${cat.label}`}
                count={count}
              />
            );
          })}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="size-5 animate-spin text-text-muted" />
        </div>
      ) : error ? (
        <div className="text-center py-10 text-text-muted">
          <p className="text-sm text-danger">{error}</p>
          <button onClick={load} className="mt-3 text-xs text-noa hover:underline">
            Reintentar
          </button>
        </div>
      ) : filteredLikes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-text-muted">
          <ThumbsUp className="size-10 mb-3 opacity-30" />
          <p className="text-sm">
            {activeTab === "all"
              ? "Aún no has guardado imágenes"
              : "No hay imágenes en esta categoría"}
          </p>
          <p className="text-xs text-text-subtle mt-1 max-w-[280px] text-center">
            Pega un link de Civitai arriba o dale 👍 a una imagen del chat
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {filteredLikes.map((like) => (
            <div
              key={like.id}
              className="relative aspect-square rounded-lg overflow-hidden bg-bg-surface border border-border group"
            >
              {like.image_url && (
                <img
                  src={like.source === "civitai" ? like.image_url : getCfTransformUrl(like.image_url, "thumb")}
                  alt={like.prompt || "Liked"}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              )}
              {like.source === "civitai" && (
                <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-sm text-[8px] font-mono text-white/80">
                  civitai
                </div>
              )}
              <button
                onClick={() => handleRemove(like.id)}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 backdrop-blur-sm text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center active:opacity-100"
                aria-label="Quitar"
              >
                <ThumbsDown className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
        active
          ? "bg-white/[0.08] text-text"
          : "text-text-muted hover:text-text"
      }`}
    >
      {label}
      {count > 0 && (
        <span
          className={`ml-1.5 text-[10px] font-mono ${active ? "text-noa" : "text-text-subtle"}`}
        >
          {count}
        </span>
      )}
    </button>
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
          className="w-12 h-14 text-center text-xl font-mono font-bold rounded-xl bg-bg-elevated border border-border text-text focus:border-noa focus:ring-1 focus:ring-noa/30 outline-none transition-all"
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
          <div className="w-10 h-10 rounded-xl bg-noa/10 flex items-center justify-center shrink-0">
            <EyeOff className="size-5 text-noa" />
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
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-noa/10 hover:bg-noa/20 text-noa text-sm font-medium transition-colors"
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
                    <Loader2 className="size-4 animate-spin text-noa" />
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
                    <Loader2 className="size-4 animate-spin text-noa" />
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
                    <Loader2 className="size-4 animate-spin text-noa" />
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
