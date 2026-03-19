import { ImageIcon, PenTool, Code, Briefcase } from "lucide-react";
import { AIStarIcon } from "@/components/shared/AIStarIcon";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Page } from "@/hooks/useNavigation";

interface Props {
  onNavigate: (page: Page) => void;
  onStartChat: (prompt: string) => void;
}

const CATEGORIES = [
  {
    icon: ImageIcon,
    title: "Explore Image Library",
    description: "Find a world generated image by other people",
    prompt: "Show me what kind of images you can generate",
  },
  {
    icon: PenTool,
    title: "Explore Writing Tools",
    description: "Generate stories, blog post, or fresh content ideas.",
    prompt: "Help me with creative writing. What can you do?",
  },
  {
    icon: Code,
    title: "Code Assistant",
    description: "Ask anything from fact to advice and get best answer.",
    prompt: "I need help with code. What languages do you support?",
  },
  {
    icon: Briefcase,
    title: "Business Tools",
    description: "Ask anything from fact to advice and get best answer.",
    prompt: "What business tools and productivity features do you offer?",
  },
] as const;

export function ExplorePage({ onNavigate, onStartChat }: Props) {
  const handleCategory = (prompt: string) => {
    onNavigate("chat");
    onStartChat(prompt);
  };

  return (
    <ScrollArea className="flex-1 h-full">
      <div className="px-4 pt-4 pb-8 space-y-6 max-w-4xl mx-auto">
        {/* Hero Banner */}
        <div className="bg-gradient-to-b from-bg-elevated to-bg-surface rounded-2xl p-8 flex flex-col items-center text-center border border-border">
          <AIStarIcon size="md" />
          <h2 className="text-2xl font-medium text-text mt-4 font-display">Introducing Kira</h2>
          <p className="text-sm text-text-muted mt-2 max-w-xs">
            Discover worlds beyond imagination with Kira
          </p>
          <Button variant="outline" size="sm" className="mt-4">
            Learn more
          </Button>
        </div>

        {/* Category Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.title}
                onClick={() => handleCategory(cat.prompt)}
                className="bg-bg-surface border border-border rounded-xl p-4 text-left hover:border-text-muted/30 transition-colors cursor-pointer"
              >
                <div className="size-9 rounded-lg bg-bg-elevated flex items-center justify-center mb-3">
                  <Icon className="size-4 text-text-muted" />
                </div>
                <p className="text-sm font-medium text-text font-display">{cat.title}</p>
                <p className="text-xs text-text-muted mt-1 line-clamp-2">{cat.description}</p>
              </button>
            );
          })}
        </div>

        {/* Featured Videos */}
        <div>
          <h3 className="text-lg font-medium text-text mb-3 font-display">Featured Videos</h3>
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="shrink-0 w-56 h-32 bg-bg-surface border border-border rounded-xl flex items-center justify-center"
              >
                <span className="text-xs text-text-subtle">Coming soon</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
