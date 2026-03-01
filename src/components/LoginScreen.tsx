import { useState } from "react";

interface Props {
  onLogin: (username: string, password: string) => Promise<void>;
}

export function LoginScreen({ onLogin }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;

    setLoading(true);
    setError("");

    try {
      await onLogin(username.trim().toLowerCase(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col items-center justify-center bg-gradient-to-b from-[#572c77]/10 via-white to-[#bcd431]/5 dark:from-[#572c77]/20 dark:via-[#0a0a0c] dark:to-[#0a0a0c] px-6 safe-top safe-bottom">
      <div className="w-full max-w-sm animate-fade-in">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-24 h-24 rounded-[22px] shadow-xl shadow-[#572c77]/20 mb-5 overflow-hidden flex items-center justify-center">
            <img
              src="/icons/kira-logo.svg"
              alt="KOAI"
              className="w-24 h-24 rounded-[22px]"
            />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
            KOAI Chat
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Kira & Kronos — KOAI Studios
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Usuario"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              disabled={loading}
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1e] px-4 py-3 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#572c77]/40 focus:border-[#572c77]/30 transition-all"
            />
          </div>
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña"
              autoComplete="current-password"
              disabled={loading}
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1e] px-4 py-3 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#572c77]/40 focus:border-[#572c77]/30 transition-all"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/30">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-500 flex-shrink-0">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !username.trim() || !password.trim()}
            className="w-full rounded-xl bg-gradient-to-r from-[#572c77] to-[#7c4d9e] hover:from-[#6b3591] hover:to-[#8a5aab] active:from-[#3d1e54] active:to-[#572c77] text-white font-semibold py-3 text-sm transition-all disabled:opacity-50 shadow-md shadow-[#572c77]/25 active:scale-[0.98]"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Entrando...
              </span>
            ) : (
              "Iniciar sesión"
            )}
          </button>
        </form>

        <p className="text-center text-[11px] text-gray-400 mt-10">
          KOAI Studios &mdash; Powered by AI
        </p>
      </div>
    </div>
  );
}
