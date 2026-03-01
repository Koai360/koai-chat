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
    <div className="flex rounded-full bg-white/15 p-[3px] gap-[2px]">
      <button
        onClick={() => { haptic(); onChange("kira"); }}
        disabled={disabled}
        className={`px-5 py-[5px] rounded-full text-[13px] font-bold tracking-wide transition-all duration-200 ${
          agent === "kira"
            ? "bg-[#bcd431] text-[#3d1e54] shadow-md shadow-[#bcd431]/30"
            : "text-white/60"
        } disabled:opacity-50 active:scale-95`}
      >
        Kira
      </button>
      <button
        onClick={() => { haptic(); onChange("kronos"); }}
        disabled={disabled}
        className={`px-5 py-[5px] rounded-full text-[13px] font-bold tracking-wide transition-all duration-200 ${
          agent === "kronos"
            ? "bg-[#bcd431] text-[#3d1e54] shadow-md shadow-[#bcd431]/30"
            : "text-white/60"
        } disabled:opacity-50 active:scale-95`}
      >
        Kronos
      </button>
    </div>
  );
}
