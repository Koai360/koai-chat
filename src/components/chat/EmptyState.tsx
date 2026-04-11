import { motion } from "framer-motion";
import type { Agent } from "@/hooks/useChat";

interface Props {
  agent: Agent;
  userName?: string;
  onSend: (text: string, imageBase64?: string, imageMode?: boolean, imageEngine?: string, editMode?: boolean, imageUrl?: string) => void;
  loading: boolean;
}

/**
 * Quick action — capability-aware shortcut shown in EmptyState.
 *
 * Each action represents a real Kira capability (image gen, voice, edit, etc).
 * Clicking pre-fills the input or directly triggers the corresponding mode.
 *
 * The "mark" is a single letter / symbol (no Lucide icons → avoids AI slop
 * fingerprint of "icon + heading + desc" cards). Letters are color-coded by
 * capability category.
 */
interface QuickAction {
  mark: string;
  /** Tier/color category — uses tokens from .impeccable.md */
  tone: "kira" | "kronos" | "premium" | "neutral";
  /** Action verb in Spanish */
  verb: string;
  /** What it does — short hint */
  hint: string;
  /** Prompt that gets pre-filled or sent */
  prompt: string;
  /** Optional engine override (passed via onSend's imageEngine arg) */
  imageMode?: boolean;
  imageEngine?: string;
}

const KIRA_ACTIONS: QuickAction[] = [
  {
    mark: "Z",
    tone: "kira",
    verb: "Generar imagen rápida",
    hint: "Z-Image · sin filtro · ~5s",
    prompt: "un café latte arte sobre una mesa de madera, fotorrealista",
    imageMode: true,
    imageEngine: "zimage",
  },
  {
    mark: "F",
    tone: "premium",
    verb: "Crear imagen premium",
    hint: "Flux.2 · 32B · $0.035",
    prompt: "fotografía editorial de un producto de lujo con iluminación cinematográfica",
    imageMode: true,
    imageEngine: "flux2",
  },
  {
    mark: "✎",
    tone: "premium",
    verb: "Editar una foto",
    hint: "Kontext Pro · cambio de ropa, fondos, look",
    prompt: "Adjunta una imagen y dime qué quieres cambiar (ej: \"cámbiale el vestido por uno rojo\").",
  },
  {
    mark: "?",
    tone: "neutral",
    verb: "Preguntar a Noa",
    hint: "Estrategia, ideas, briefs",
    prompt: "",
  },
];

const KRONOS_ACTIONS: QuickAction[] = [
  {
    mark: "</",
    tone: "kronos",
    verb: "Revisar código",
    hint: "Bug, refactor, review",
    prompt: "Revisa este código y dime qué mejorar:\n\n",
  },
  {
    mark: "⌘",
    tone: "kronos",
    verb: "Diseñar arquitectura",
    hint: "Sistemas, schemas, infra",
    prompt: "Necesito diseñar la arquitectura para",
  },
  {
    mark: "↑",
    tone: "kronos",
    verb: "Deploy / ops",
    hint: "Servidor, CI/CD, debug",
    prompt: "",
  },
  {
    mark: "?",
    tone: "neutral",
    verb: "Preguntar a Kronos",
    hint: "Cualquier cosa técnica",
    prompt: "",
  },
];

const TONE_STYLES: Record<QuickAction["tone"], { color: string; glow: string; bg: string }> = {
  kira:    { color: "#D4E94B", glow: "rgba(212,233,75,0.30)", bg: "rgba(212,233,75,0.06)" },
  kronos:  { color: "#00E5FF", glow: "rgba(0,229,255,0.30)",  bg: "rgba(0,229,255,0.06)"  },
  premium: { color: "#7B2D8E", glow: "rgba(123,45,142,0.40)", bg: "rgba(123,45,142,0.08)" },
  neutral: { color: "rgba(255,255,255,0.85)", glow: "rgba(255,255,255,0.18)", bg: "rgba(255,255,255,0.04)" },
};

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Buenos días";
  if (hour < 17) return "Buenas tardes";
  return "Buenas noches";
}

export function EmptyState({ agent, userName, onSend, loading }: Props) {
  const greeting = getGreeting();
  const displayName = userName?.split(" ")[0] || (agent === "kronos" ? "Boss" : "");
  const actions = agent === "kronos" ? KRONOS_ACTIONS : KIRA_ACTIONS;
  const isKronos = agent === "kronos";

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 pb-20 md:pb-24">
      <div className="w-full max-w-xl">
        {/* Greeting — left-aligned, asymmetric (not centered). Sin AIStarIcon (eliminado por diseño) */}
        <motion.div
          initial={{ y: 16, opacity: 0, filter: "blur(6px)" }}
          animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
          transition={{ delay: 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="mb-1"
        >
          <h2
            className="font-display text-[28px] md:text-[36px] font-medium text-text leading-[1.05]"
            style={{ letterSpacing: "-0.025em" }}
          >
            {greeting}
            {displayName ? (
              <>
                ,{" "}
                <span className={isKronos ? "gradient-text-kronos" : "gradient-text-kira"}>
                  {displayName}
                </span>
              </>
            ) : ""}
          </h2>
        </motion.div>

        {/* Subline */}
        <motion.p
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="font-display text-[18px] md:text-[20px] text-text-muted leading-tight mb-7"
          style={{ letterSpacing: "-0.015em" }}
        >
          ¿Por dónde empezamos hoy?
        </motion.p>

        {/* Quick actions — vertical list, NOT a 2x2 grid (avoids icon-card-grid AI slop) */}
        <div className="space-y-1.5">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="px-1 mb-2"
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-subtle">
              Acciones rápidas
            </span>
          </motion.div>

          {actions.map((action, i) => {
            const tone = TONE_STYLES[action.tone];
            return (
              <motion.button
                key={`${action.verb}-${i}`}
                disabled={loading}
                onClick={() => {
                  if (loading) return;
                  if (navigator.vibrate) navigator.vibrate(8);
                  onSend(action.prompt, undefined, action.imageMode, action.imageEngine);
                }}
                initial={{ opacity: 0, x: -8, filter: "blur(4px)" }}
                animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                transition={{
                  delay: 0.35 + i * 0.06,
                  duration: 0.4,
                  ease: [0.16, 1, 0.3, 1],
                }}
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.985 }}
                className="
                  group
                  w-full flex items-center gap-3
                  px-3 py-2.5
                  rounded-xl
                  transition-[background,box-shadow] duration-300
                  hover:bg-bg-surface
                  disabled:opacity-40
                  text-left
                  border border-transparent
                  hover:border-border
                "
              >
                {/* Mark — large letter/symbol, color-coded */}
                <span
                  className="
                    shrink-0
                    w-9 h-9
                    rounded-lg
                    flex items-center justify-center
                    font-display font-bold
                    transition-all duration-300
                    group-hover:scale-105
                  "
                  style={{
                    fontSize: "16px",
                    color: tone.color,
                    background: tone.bg,
                    boxShadow: `inset 0 0 0 1px ${tone.glow}`,
                    letterSpacing: "-0.04em",
                  }}
                >
                  {action.mark}
                </span>

                {/* Verb + hint */}
                <div className="flex-1 min-w-0">
                  <div
                    className="font-display text-[14px] font-medium text-text truncate"
                    style={{ letterSpacing: "-0.012em" }}
                  >
                    {action.verb}
                  </div>
                  <div
                    className="font-mono text-[10.5px] truncate"
                    style={{
                      color: "rgba(255,255,255,0.40)",
                      marginTop: "1px",
                    }}
                  >
                    {action.hint}
                  </div>
                </div>

                {/* Hover affordance — chevron only on hover */}
                <span
                  className="
                    shrink-0
                    text-text-subtle opacity-0 group-hover:opacity-60
                    transition-opacity duration-300
                    text-[18px] leading-none
                    -translate-x-1 group-hover:translate-x-0
                  "
                >
                  →
                </span>
              </motion.button>
            );
          })}
        </div>

        {/* Footer hint — subtle, mono */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.6 }}
          className="mt-6 px-1"
        >
          <span className="font-mono text-[10px] text-text-subtle tracking-tight">
            o escribe directamente abajo
          </span>
        </motion.div>
      </div>
    </div>
  );
}
