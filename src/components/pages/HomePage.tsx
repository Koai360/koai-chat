import { useMemo } from "react";
import { AIStarIcon } from "@/components/shared/AIStarIcon";
import type { Page } from "@/hooks/useNavigation";

interface Props {
  userName: string;
  onSend: (text: string) => void;
  onNavigate: (page: Page) => void;
}

const SUGGESTIONS = [
  {
    title: "Summarize Text",
    description: "Turn long articles into easy summaries.",
    prompt: "Summarize the following text for me:",
  },
  {
    title: "Creative Writing",
    description: "Generate stories, blog post, or fresh content ideas.",
    prompt: "Help me write a creative blog post about",
  },
  {
    title: "Answer Questions",
    description: "Ask anything from fact to advice and get best answer.",
    prompt: "I have a question:",
  },
] as const;

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Morning";
  if (hour <= 17) return "Afternoon";
  return "Evening";
}

export function HomePage({ userName, onSend, onNavigate }: Props) {
  const greeting = useMemo(() => getGreeting(), []);
  const firstName = userName.split(" ")[0] || userName;

  const handleSuggestion = (prompt: string) => {
    onNavigate("chat");
    onSend(prompt);
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 pb-24">
      <div className="flex flex-col items-center gap-6 max-w-lg w-full">
        {/* AI Star */}
        <AIStarIcon size="lg" />

        {/* Greeting */}
        <div className="text-center space-y-2 mt-2">
          <h1 className="text-4xl font-medium tracking-tight text-text font-display">
            Good {greeting}, {firstName}
          </h1>
          <p className="text-base text-text-muted">What's on your mind?</p>
        </div>

        {/* Suggestion Cards */}
        <div className="grid gap-3 w-full mt-4">
          {SUGGESTIONS.map((s) => (
            <button
              key={s.title}
              onClick={() => handleSuggestion(s.prompt)}
              className="bg-bg-surface border border-border rounded-lg p-4 cursor-pointer hover:border-text-muted/30 transition-colors text-left"
            >
              <p className="text-sm font-medium text-text font-display">{s.title}</p>
              <p className="text-sm text-text-muted mt-1">{s.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
