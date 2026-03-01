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
    <div className="flex rounded-full bg-gray-100/80 dark:bg-gray-800/80 p-[3px] gap-[2px]">
      <button
        onClick={() => { haptic(); onChange("kira"); }}
        disabled={disabled}
        className={`px-5 py-[5px] rounded-full text-[13px] font-semibold transition-all duration-200 ${
          agent === "kira"
            ? "bg-white dark:bg-gray-700 text-pink-500 shadow-sm"
            : "text-gray-400 dark:text-gray-500"
        } disabled:opacity-50 active:scale-95`}
      >
        Kira
      </button>
      <button
        onClick={() => { haptic(); onChange("kronos"); }}
        disabled={disabled}
        className={`px-5 py-[5px] rounded-full text-[13px] font-semibold transition-all duration-200 ${
          agent === "kronos"
            ? "bg-white dark:bg-gray-700 text-indigo-500 shadow-sm"
            : "text-gray-400 dark:text-gray-500"
        } disabled:opacity-50 active:scale-95`}
      >
        Kronos
      </button>
    </div>
  );
}
