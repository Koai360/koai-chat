interface Props {
  onUpdate: () => void;
}

export function UpdateBanner({ onUpdate }: Props) {
  return (
    <div className="bg-indigo-500 text-white text-center py-2 px-4 text-sm flex items-center justify-center gap-3">
      <span>Nueva versión disponible</span>
      <button
        onClick={onUpdate}
        className="bg-white text-indigo-600 rounded-full px-3 py-0.5 text-xs font-semibold hover:bg-indigo-50 transition-colors"
      >
        Actualizar
      </button>
    </div>
  );
}
