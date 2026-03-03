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
    <div className="flex rounded-full p-[3px] gap-[2px] bg-white/[0.06]">
      <button
        onClick={() => { haptic(); onChange("kira"); }}
        disabled={disabled}
        className={`px-5 py-[5px] rounded-full text-[13px] font-bold tracking-wide transition-all duration-300 ${
          agent === "kira"
            ? "bg-[#bcd431] text-black"
            : "text-[#9b9b9b]"
        } disabled:opacity-50 active:scale-95`}
      >
        Kira
      </button>
      <button
        onClick={() => { haptic(); onChange("kronos"); }}
        disabled={disabled}
        className={`px-5 py-[5px] rounded-full text-[13px] font-bold tracking-wide transition-all duration-300 ${
          agent === "kronos"
            ? "bg-[#bcd431] text-black"
            : "text-[#9b9b9b]"
        } disabled:opacity-50 active:scale-95`}
      >
        Kronos
      </button>
    </div>
  );
}
