import { useMemo } from "react";
import { Sparkle } from "./Sparkle";

interface ChatEmptyProps {
  userName?: string;
}

/**
 * Devuelve la hora local en zona horaria Miami (ET).
 * Robusto a navegadores con tz distinta — usa Intl.DateTimeFormat.
 */
function getMiamiHour(): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      hour12: false,
    }).formatToParts(new Date());
    const hourPart = parts.find((p) => p.type === "hour");
    return hourPart ? Number(hourPart.value) : new Date().getHours();
  } catch {
    return new Date().getHours();
  }
}

/**
 * Bucket por hora (Miami):
 *   madrugada → 0-4
 *   mañana    → 5-11
 *   tarde     → 12-18
 *   noche     → 19-23
 */
type DayPart = "madrugada" | "mañana" | "tarde" | "noche";
function getDayPart(h: number): DayPart {
  if (h >= 5 && h < 12) return "mañana";
  if (h >= 12 && h < 19) return "tarde";
  if (h >= 19 && h < 24) return "noche";
  return "madrugada";
}

const TIME_GREETINGS: Record<DayPart, string[]> = {
  madrugada: [
    "Aún despierto, {name}",
    "Madrugando, {name}",
    "Hora tranquila, {name}",
    "{name}, acá estoy",
  ],
  mañana: [
    "Buenos días, {name}",
    "Buen día, {name}",
    "Arrancamos, {name}",
    "{name}, ¿cómo amaneciste?",
    "Listo para el día, {name}",
  ],
  tarde: [
    "Buenas tardes, {name}",
    "¿Cómo va la tarde, {name}?",
    "{name}, ¿qué necesitás?",
    "Acá seguimos, {name}",
    "{name}, ¿en qué te ayudo?",
  ],
  noche: [
    "Buenas noches, {name}",
    "{name}, ¿cerramos el día?",
    "Última hora del día, {name}",
    "Acá estoy, {name}",
    "{name}, cuéntame qué pasa",
  ],
};

const PROACTIVE_PROMPTS: Record<DayPart, string[]> = {
  madrugada: [
    "¿Algo te quita el sueño?",
    "Acá para lo que necesites",
    "¿Repasamos pendientes?",
  ],
  mañana: [
    "¿Empezamos con el cash del día?",
    "¿Reviso leads nuevos?",
    "¿Qué arrancamos primero?",
    "¿Te muestro el resumen del día?",
    "¿Algún cliente urgente?",
  ],
  tarde: [
    "¿Cómo van las ventas?",
    "¿Revisamos pendientes?",
    "¿Te ayudo con algún cliente?",
    "¿Avanzamos con tu lista?",
    "¿Querés ver leads de hoy?",
  ],
  noche: [
    "¿Cerramos cuentas del día?",
    "¿Resumen antes de cerrar?",
    "¿Algo que dejar listo para mañana?",
    "¿Repasamos lo de hoy?",
  ],
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * ChatEmpty — empty state estilo Gemini Neural Expressive.
 *
 * Greeting dinámico: rota entre N templates según hora local Miami.
 * Cada montaje del componente elige uno aleatorio del bucket horario,
 * más un proactive prompt debajo (sutil, mismo bucket). Memoizado para
 * que no cambie en re-renders.
 */
export function ChatEmpty({ userName = "Jesús" }: ChatEmptyProps) {
  const { greeting, proactive } = useMemo(() => {
    const h = getMiamiHour();
    const part = getDayPart(h);
    const tpl = pick(TIME_GREETINGS[part]).replace("{name}", "__NAME__");
    return {
      greeting: tpl,
      proactive: pick(PROACTIVE_PROMPTS[part]),
    };
  }, []);

  const today = new Date().toLocaleDateString("es-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/New_York",
  });

  // Split greeting around __NAME__ para aplicar gradient solo al nombre.
  const [before, after] = greeting.split("__NAME__");

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
          {before}
          <span style={{ color: "#C8DD4A" }}>{userName}</span>
          {after}
        </h1>

        <p className="text-[15px] md:text-[16px] text-white/55 mt-5">
          {proactive}
        </p>
      </div>
    </div>
  );
}
