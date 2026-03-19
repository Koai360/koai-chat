import { motion } from "framer-motion";
import { FileText, PenTool, Zap } from "lucide-react";
import { AIStarIcon } from "@/components/shared/AIStarIcon";
import type { Agent } from "@/hooks/useChat";

interface Props {
  agent: Agent;
  userName?: string;
  onSend: (text: string) => void;
  loading: boolean;
}

const SUGGESTIONS = [
  {
    icon: FileText,
    title: "Summarize",
    description: "Condense long texts into key points",
    prompt: "Summarize the key points of this topic",
  },
  {
    icon: PenTool,
    title: "Creative Writing",
    description: "Generate creative content and copy",
    prompt: "Help me write creative content",
  },
  {
    icon: Zap,
    title: "Answer Questions",
    description: "Get quick answers to your questions",
    prompt: "Answer my questions about any topic",
  },
];

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function EmptyState({ agent, userName, onSend, loading }: Props) {
  const greeting = getGreeting();
  const displayName = userName || (agent === "kronos" ? "Boss" : "");

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="flex-1 flex flex-col items-center justify-center px-6 pb-32"
    >
      {/* AI Star Icon */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="mb-6"
      >
        <AIStarIcon size="lg" />
      </motion.div>

      {/* Greeting */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="text-center mb-10"
      >
        <h2 className="text-[24px] md:text-[32px] font-medium text-text leading-tight font-display">
          {greeting}{displayName ? `, ${displayName}` : ""}
        </h2>
        <h2 className="text-[24px] md:text-[32px] font-medium text-text-muted leading-tight font-display">
          What's on your mind?
        </h2>
      </motion.div>

      {/* Suggestion Cards */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="flex flex-col md:flex-row gap-3 w-full max-w-2xl overflow-x-auto md:overflow-visible no-scrollbar"
      >
        {SUGGESTIONS.map((suggestion, index) => (
          <motion.button
            key={suggestion.title}
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 + index * 0.1, duration: 0.4 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => !loading && onSend(suggestion.prompt)}
            disabled={loading}
            className="flex-1 min-w-[180px] bg-bg-surface border border-border rounded-lg p-4 text-left transition-colors hover:bg-bg-elevated disabled:opacity-50"
          >
            <suggestion.icon className="h-4 w-4 mb-3" style={{ color: agent === 'kronos' ? '#00E5FF' : '#C5E34A' }} />
            <div className="text-sm font-medium text-text font-display">{suggestion.title}</div>
            <div className="text-xs text-text-muted mt-1">{suggestion.description}</div>
          </motion.button>
        ))}
      </motion.div>
    </motion.div>
  );
}
