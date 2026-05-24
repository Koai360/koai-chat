import { Component, type ReactNode } from "react";
import { Sparkle } from "@/components/chat/Sparkle";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** UI alternativa cuando una sub-tree falla. Por default usa el fallback con sparkle + reset. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
  /** Llamado cuando se captura un error. Útil para logs/sentry. */
  onError?: (error: Error, info: { componentStack?: string | null }) => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * ErrorBoundary — captura render throws y muestra un fallback recuperable.
 *
 * React 19 sigue sin tener boundary nativo de componente — hay que usar class.
 * Sin esto un throw en MessageBubble/CardRenderer/markdown render unmount el
 * árbol entero → blank-screen sin recovery (P1-2 audit).
 *
 * Uso típico (top-level en main.tsx):
 *   <ErrorBoundary>
 *     <App />
 *   </ErrorBoundary>
 *
 * Uso local con fallback custom (CardRenderer):
 *   <ErrorBoundary fallback={(err, reset) => <CardError onRetry={reset} />}>
 *     <CashFlowCard data={data} />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error("[ErrorBoundary] render throw", error, info.componentStack);
    this.props.onError?.(error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }
      return (
        <div className="h-full w-full flex items-center justify-center px-6 bg-[var(--color-bg-void)]">
          <div className="max-w-md text-center space-y-5">
            <div className="flex justify-center">
              <Sparkle size={36} />
            </div>
            <h1 className="text-2xl text-white font-medium">Algo falló</h1>
            <p className="text-white/60 text-[15px] leading-relaxed">
              Noa tuvo un problema renderizando esta vista. Tus datos están a salvo —
              recargá la app o probá de nuevo.
            </p>
            <div className="flex gap-3 justify-center pt-2">
              <button
                type="button"
                onClick={this.reset}
                className="px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/15 text-white text-sm transition-colors"
              >
                Reintentar
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-5 py-2.5 rounded-full bg-[var(--color-noa,#C8DD4A)] hover:opacity-90 text-black text-sm font-medium transition-opacity"
              >
                Recargar
              </button>
            </div>
            <details className="text-left text-xs text-white/40 mt-6 cursor-pointer">
              <summary>Detalles técnicos</summary>
              <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words font-mono text-[11px] text-white/50">
                {this.state.error.message}
              </pre>
            </details>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
