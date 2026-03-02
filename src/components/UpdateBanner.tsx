interface Props {
  onUpdate: () => void;
}

export function UpdateBanner({ onUpdate }: Props) {
  return (
    <div className="fixed bottom-20 left-4 right-4 z-[100] safe-bottom">
      <div className="bg-koai-lime text-koai-purple-dark text-center py-3 px-5 rounded-2xl shadow-2xl flex items-center justify-center gap-3">
        <span className="text-sm font-semibold">Nueva version disponible</span>
        <button
          onClick={onUpdate}
          className="bg-koai-purple text-white rounded-full px-5 py-1.5 text-sm font-bold active:scale-95 transition-transform"
        >
          Actualizar
        </button>
      </div>
    </div>
  );
}
