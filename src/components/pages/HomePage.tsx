import { useMemo } from "react";
import { Sparkles, Pen, HelpCircle } from "lucide-react";
import { AIStarIcon } from "@/components/shared/AIStarIcon";
import type { Page } from "@/hooks/useNavigation";

interface Props {
  userName: string;
  onSend: (text: string) => void;
  onNavigate: (page: Page) => void;
}

const SUGGESTIONS = [
  {
    title: "Resumir Texto",
    description: "Convierte artículos largos en resúmenes claros.",
    prompt: "Resúmeme el siguiente texto:",
    icon: Sparkles,
  },
  {
    title: "Escritura Creativa",
    description: "Genera historias, posts o ideas frescas de contenido.",
    prompt: "Ayúdame a escribir un post creativo sobre",
    icon: Pen,
  },
  {
    title: "Responder Preguntas",
    description: "Pregunta lo que sea y obtén la mejor respuesta.",
    prompt: "Tengo una pregunta:",
    icon: HelpCircle,
  },
] as const;

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Buenos días";
  if (hour <= 17) return "Buenas tardes";
  return "Buenas noches";
}

export function HomePage({ userName, onSend, onNavigate }: Props) {
  const greeting = useMemo(() => getGreeting(), []);
  const firstName = userName.split(" ")[0] || userName;

  const handleSuggestion = (prompt: string) => {
    onNavigate("chat");
    onSend(prompt);
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 pb-4 overflow-y-auto">
      <div className="flex flex-col items-center gap-6 max-w-lg w-full">
        {/* AI Star with glow */}
        <div
          className="animate-fadeUpBlur"
          style={{ filter: "drop-shadow(0 0 30px rgba(197, 227, 74, 0.2))" }}
        >
          <AIStarIcon size="lg" />
        </div>

        {/* Greeting */}
        <div className="text-center space-y-2 mt-2">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-medium tracking-tight text-text font-display animate-fadeUpBlur stagger-2">
            {greeting},{" "}
            <span className="gradient-text-kira">{firstName}</span>
          </h1>
          <p className="text-base text-text-muted animate-fadeUpBlur stagger-3">
            ¿En qué puedo ayudarte hoy?
          </p>
        </div>

        {/* Suggestion Cards — liquid glass */}
        <div className="grid gap-3 w-full mt-4">
          {SUGGESTIONS.map((s, i) => {
            const Icon = s.icon;
            return (
              <button
                key={s.title}
                onClick={() => handleSuggestion(s.prompt)}
                className={`liquid-glass-strong rounded-2xl p-4 cursor-pointer hover:scale-[1.02] transition-all duration-300 text-left animate-fadeUpBlur stagger-${i + 4}`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-kira-soft flex items-center justify-center shrink-0 mt-0.5">
                    <Icon className="w-4 h-4 text-kira" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text font-display">{s.title}</p>
                    <p className="text-sm text-text-muted mt-0.5">{s.description}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
