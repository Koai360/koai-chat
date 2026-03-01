import type { Agent } from "../hooks/useChat";

interface Props {
  agent: Agent;
  onChange: (agent: Agent) => void;
  disabled?: boolean;
}

function haptic() {
  if (navigator.vibrate) navigator.vibrate(8);
}

export function AgentToggle({ agent, onChange, disabled }: Props) {
  return (
    <div className="flex rounded-full bg-gray-100 dark:bg-gray-800 p-0.5 gap-0.5 relative">
      <button
        onClick={() => { haptic(); onChange("kira"); }}
        disabled={disabled}
        className={`relative z-10 px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
          agent === "kira"
            ? "bg-gradient-to-r from-pink-500 to-rose-400 text-white shadow-md shadow-pink-500/25"
            : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
        } disabled:opacity-50`}
      >
        Kira
      </button>
      <button
        onClick={() => { haptic(); onChange("kronos"); }}
        disabled={disabled}
        className={`relative z-10 px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
          agent === "kronos"
            ? "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-500/25"
            : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
        } disabled:opacity-50`}
      >
        Kronos
      </button>
    </div>
  );
}
