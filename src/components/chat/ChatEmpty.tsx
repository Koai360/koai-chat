import { Sparkle } from "./Sparkle";

interface ChatEmptyProps {
  userName?: string;
}

/**
 * ChatEmpty — empty state estilo Gemini Neural Expressive.
 *
 * Layout:
 * - Sparkle 48px centered (anchor visual KOAI lime→purple)
 * - Hero greeting Sora 600 gigante con "nombre" en gradient
 * - Sin sugerencias (decisión Jesús: limpio total)
 * - Input bar sticky bottom (renderizado en parent ChatSurface)
 *
 * Posicionamiento: centrado vertical alto (~40% viewport desde top) para
 * dejar respirar la mitad inferior donde el bg gradient violet/sapphire vive.
 */
export function ChatEmpty({ userName = "Jesús" }: ChatEmptyProps) {
  const today = new Date().toLocaleDateString("es-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/New_York",
  });

  return (
    <div className="flex flex-col items-center justify-center min-h-full px-6 pb-32 pt-12">
      <div className="flex flex-col items-center text-center max-w-xl mx-auto">
        <Sparkle size={48} animate className="mb-6" />

        <p className="mono text-[11px] uppercase tracking-[0.16em] text-white/40 mb-4">
          {today}
        </p>

        <h1
          className="display font-semibold text-white leading-[1.05] tracking-tight"
          style={{ fontSize: "clamp(2.5rem, 7vw, 3.75rem)" }}
        >
          Pregunta lo que quieras,{" "}
          <span
            className="bg-clip-text text-transparent"
            style={{
              backgroundImage: "linear-gradient(135deg, #C8DD4A 0%, #7B6CB5 50%, #6B3F8E 100%)",
            }}
          >
            {userName}
          </span>
        </h1>
      </div>
    </div>
  );
}
