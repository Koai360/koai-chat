import { motion } from "framer-motion";
import { Image, Search, UserSearch, CalendarClock, FileText, StickyNote } from "lucide-react";

export interface SlashCommand {
  command: string;
  label: string;
  hint: string;
  icon: typeof Image;
  color: string;
  action: "prefill" | "mode" | "navigate";
  /** Para prefill: texto que se inyecta. Para mode: activa imageMode. Para navigate: page hash */
  payload: string;
}

const COMMANDS: SlashCommand[] = [
  {
    command: "/imagen",
    label: "Generar imagen",
    hint: "Activa modo imagen",
    icon: Image,
    color: "#D4E94B",
    action: "mode",
    payload: "image",
  },
  {
    command: "/buscar",
    label: "Buscar en web",
    hint: "/buscar [query]",
    icon: Search,
    color: "#00E5FF",
    action: "prefill",
    payload: "busca información sobre: ",
  },
  {
    command: "/contacto",
    label: "Buscar contacto",
    hint: "/contacto [nombre]",
    icon: UserSearch,
    color: "#E5A3F0",
    action: "prefill",
    payload: "busca el contacto: ",
  },
  {
    command: "/tarea",
    label: "Programar tarea",
    hint: "/tarea [descripción]",
    icon: CalendarClock,
    color: "#FFA726",
    action: "prefill",
    payload: "programa una tarea: ",
  },
  {
    command: "/pdf",
    label: "Generar PDF",
    hint: "/pdf [título]",
    icon: FileText,
    color: "#EF5350",
    action: "prefill",
    payload: "genera un documento PDF sobre: ",
  },
  {
    command: "/notas",
    label: "Notas",
    hint: "Ir a notas",
    icon: StickyNote,
    color: "#FFEE58",
    action: "navigate",
    payload: "#/notes",
  },
];

interface Props {
  filter: string;
  onSelect: (cmd: SlashCommand) => void;
  selectedIndex: number;
}

export function SlashCommandMenu({ filter, onSelect, selectedIndex }: Props) {
  const filtered = COMMANDS.filter((cmd) =>
    cmd.command.startsWith(filter.toLowerCase()) || cmd.label.toLowerCase().includes(filter.slice(1).toLowerCase())
  );

  if (filtered.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
      className="absolute bottom-full left-0 right-0 mb-2 mx-1 rounded-xl border border-border overflow-hidden shadow-2xl"
      style={{ backgroundColor: "#0f0f12" }}
    >
      <div className="px-3 py-1.5 border-b border-white/10">
        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/40">
          Comandos
        </span>
      </div>
      {filtered.map((cmd, i) => {
        const Icon = cmd.icon;
        const isSelected = i === selectedIndex;
        return (
          <button
            key={cmd.command}
            onClick={() => onSelect(cmd)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
              isSelected ? "bg-white/10" : "hover:bg-white/5"
            }`}
          >
            <div
              className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${cmd.color}15` }}
            >
              <Icon className="size-3.5" style={{ color: cmd.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-medium text-white">{cmd.label}</div>
              <div className="text-[10px] text-white/40 font-mono">{cmd.hint}</div>
            </div>
            <span className="font-mono text-[10px] text-white/25">{cmd.command}</span>
          </button>
        );
      })}
    </motion.div>
  );
}

export { COMMANDS };
