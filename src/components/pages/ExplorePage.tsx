import { ScrollArea } from "@/components/ui/scroll-area";
import { motion } from "framer-motion";
import type { Page } from "@/hooks/useNavigation";

interface Props {
  onNavigate: (page: Page) => void;
  onStartChat: (prompt: string, imageBase64?: string, imageMode?: boolean, imageEngine?: string) => void;
}

/**
 * ExplorePage — descubrir capacidades de Kira/Kronos.
 *
 * Diseño en español, sin AI slop (no 2x2 icon-cards). Cada categoría es una
 * fila con un mark de letra/símbolo color-coded por tipo, label en español,
 * descripción concreta y prompt accionable. Misma identidad visual que
 * EmptyState para coherencia.
 */

interface ExploreItem {
  mark: string;
  tone: "kira" | "kronos" | "premium" | "neutral";
  title: string;
  description: string;
  prompt: string;
  imageMode?: boolean;
  imageEngine?: string;
}

const SECTIONS: { heading: string; items: ExploreItem[] }[] = [
  {
    heading: "Generación de imagen",
    items: [
      {
        mark: "Z",
        tone: "kira",
        title: "Z-Image-Turbo",
        description: "Rápido y económico — 9 steps, ~$0.016 por imagen",
        prompt: "una taza de café latte arte sobre madera, fotorealista, luz natural suave",
        imageMode: true,
        imageEngine: "zimage",
      },
      {
        mark: "F",
        tone: "premium",
        title: "Flux.2 Dev FP8",
        description: "32B premium — mejor texto en imagen, manos perfectas",
        prompt: "fotografía editorial de producto de lujo, iluminación cinematográfica, ultra detallado",
        imageMode: true,
        imageEngine: "flux2",
      },
      {
        mark: "G",
        tone: "neutral",
        title: "Gemini",
        description: "Gratis y veloz — ideal para batch de ideas rápidas",
        prompt: "ilustración minimalista de una mascota corporativa para una marca de café",
        imageMode: true,
        imageEngine: "gemini",
      },
    ],
  },
  {
    heading: "Creatividad y marketing",
    items: [
      {
        mark: "✺",
        tone: "kira",
        title: "Copy de campaña",
        description: "Anuncios para Instagram, Meta Ads, email marketing",
        prompt: "Ayúdame a escribir un anuncio para Instagram sobre un servicio de cleaning premium en Miami",
      },
      {
        mark: "≈",
        tone: "kira",
        title: "Brief estratégico",
        description: "Posicionamiento, audiencia, mensajes clave por canal",
        prompt: "Necesito un brief estratégico de marketing para una marca nueva de bebidas energéticas",
      },
      {
        mark: "❒",
        tone: "kira",
        title: "Ideas para Print Factory",
        description: "Stickers, vinilos, mockups, variaciones de diseño",
        prompt: "Dame 5 ideas de stickers para una pizzería con estética retro miami",
      },
    ],
  },
  {
    heading: "Código y técnica (Kronos)",
    items: [
      {
        mark: "</",
        tone: "kronos",
        title: "Revisión de código",
        description: "Bugs, refactor, mejoras, code review",
        prompt: "Cambia a Kronos. Necesito que revises un componente React.",
      },
      {
        mark: "⌘",
        tone: "kronos",
        title: "Arquitectura de sistemas",
        description: "Diseño de schemas, APIs, infraestructura, deploy",
        prompt: "Cambia a Kronos. Necesito diseñar la arquitectura de un nuevo módulo.",
      },
      {
        mark: "↑",
        tone: "kronos",
        title: "Deploy y operaciones",
        description: "VPS, Cloudflare, GitHub Actions, debugging producción",
        prompt: "Cambia a Kronos. Tengo un problema en producción que no entiendo.",
      },
    ],
  },
];

const TONE_STYLES: Record<ExploreItem["tone"], { color: string; glow: string; bg: string }> = {
  kira:    { color: "#D4E94B", glow: "rgba(212,233,75,0.30)", bg: "rgba(212,233,75,0.06)" },
  kronos:  { color: "#00E5FF", glow: "rgba(0,229,255,0.30)",  bg: "rgba(0,229,255,0.06)"  },
  premium: { color: "#7B2D8E", glow: "rgba(123,45,142,0.40)", bg: "rgba(123,45,142,0.08)" },
  neutral: { color: "rgba(255,255,255,0.85)", glow: "rgba(255,255,255,0.18)", bg: "rgba(255,255,255,0.04)" },
};

export function ExplorePage({ onNavigate, onStartChat }: Props) {
  const handleStart = (item: ExploreItem) => {
    onNavigate("chat");
    onStartChat(item.prompt, undefined, item.imageMode, item.imageEngine);
  };

  return (
    <ScrollArea className="flex-1 h-full">
      <div className="px-4 pt-5 pb-8 max-w-3xl mx-auto">
        {/* Header asimétrico left-aligned (no centered hero) */}
        <div className="mb-7">
          <h1
            className="font-display text-[26px] md:text-[34px] font-medium text-text leading-[1.05]"
            style={{ letterSpacing: "-0.025em" }}
          >
            Explora{" "}
            <span className="gradient-text-kira">capacidades</span>
          </h1>
          <p
            className="font-display text-[15px] md:text-[17px] text-text-muted mt-1.5 leading-snug"
            style={{ letterSpacing: "-0.012em" }}
          >
            Click en cualquier acción para empezar.
          </p>
        </div>

        {/* Sections — list style, NOT 2x2 icon grid */}
        <div className="space-y-6">
          {SECTIONS.map((section, sIdx) => (
            <motion.section
              key={section.heading}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + sIdx * 0.08, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="px-1 mb-2 flex items-baseline justify-between">
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-subtle">
                  {section.heading}
                </span>
                <span className="font-mono text-[9px] tracking-tight text-text-subtle">
                  {section.items.length} acciones
                </span>
              </div>

              <div className="space-y-1.5">
                {section.items.map((item, i) => {
                  const tone = TONE_STYLES[item.tone];
                  return (
                    <motion.button
                      key={item.title}
                      onClick={() => handleStart(item)}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        delay: 0.15 + sIdx * 0.08 + i * 0.04,
                        duration: 0.4,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                      whileHover={{ x: 2 }}
                      whileTap={{ scale: 0.985 }}
                      className="
                        group w-full flex items-center gap-3
                        px-3 py-3
                        rounded-xl
                        text-left
                        border border-transparent
                        hover:border-border hover:bg-bg-surface
                        transition-[background,border-color] duration-300
                      "
                    >
                      <span
                        className="
                          shrink-0 w-10 h-10 rounded-lg
                          flex items-center justify-center
                          font-display font-bold
                          transition-transform duration-300
                          group-hover:scale-105
                        "
                        style={{
                          fontSize: "17px",
                          color: tone.color,
                          background: tone.bg,
                          boxShadow: `inset 0 0 0 1px ${tone.glow}`,
                          letterSpacing: "-0.04em",
                        }}
                      >
                        {item.mark}
                      </span>

                      <div className="flex-1 min-w-0">
                        <div
                          className="font-display text-[14.5px] font-medium text-text truncate"
                          style={{ letterSpacing: "-0.012em" }}
                        >
                          {item.title}
                        </div>
                        <div
                          className="font-mono text-[10.5px] truncate"
                          style={{ color: "rgba(255,255,255,0.42)", marginTop: "1px" }}
                        >
                          {item.description}
                        </div>
                      </div>

                      <span className="shrink-0 text-text-subtle opacity-0 group-hover:opacity-60 transition-opacity duration-300 text-[18px] leading-none -translate-x-1 group-hover:translate-x-0">
                        →
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </motion.section>
          ))}
        </div>
      </div>
    </ScrollArea>
  );
}
