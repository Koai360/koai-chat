interface Props {
  onUpdate: () => void;
}

export function UpdateBanner({ onUpdate }: Props) {
  return (
    <div className="relative z-30 bg-koai-lime text-koai-purple-dark text-center py-2.5 px-4 text-sm font-medium flex items-center justify-center gap-3">
      <span>Nueva versión disponible</span>
      <button
        onClick={onUpdate}
        className="bg-koai-purple text-white rounded-full px-4 py-1 text-xs font-semibold active:scale-95 transition-transform"
      >
        Actualizar
      </button>
    </div>
  );
}
