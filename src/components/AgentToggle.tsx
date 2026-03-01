import type { Agent } from "../hooks/useChat";

interface Props {
  agent: Agent;
  onChange: (agent: Agent) => void;
  disabled?: boolean;
}

export function AgentToggle({ agent, onChange, disabled }: Props) {
  return (
    <div className="flex rounded-full bg-gray-100 dark:bg-gray-800 p-1 gap-1">
      <button
        onClick={() => onChange("kira")}
        disabled={disabled}
        className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
          agent === "kira"
            ? "bg-pink-500 text-white shadow-sm"
            : "text-gray-500 dark:text-gray-400 hover:text-gray-700"
        }`}
      >
        Kira
      </button>
      <button
        onClick={() => onChange("kronos")}
        disabled={disabled}
        className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
          agent === "kronos"
            ? "bg-indigo-500 text-white shadow-sm"
            : "text-gray-500 dark:text-gray-400 hover:text-gray-700"
        }`}
      >
        Kronos
      </button>
    </div>
  );
}
