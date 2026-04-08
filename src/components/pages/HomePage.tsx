import { EmptyState } from "@/components/chat/EmptyState";
import type { Page } from "@/hooks/useNavigation";

interface Props {
  userName: string;
  onSend: (text: string, imageBase64?: string, imageMode?: boolean, imageEngine?: string) => void;
  onNavigate: (page: Page) => void;
}

/**
 * HomePage — pantalla de inicio cuando el usuario abre la app.
 *
 * Reutiliza EmptyState (mismo componente que se muestra en una conversación
 * vacía) para que el rediseño v2 con quick actions capacidad-aware sea
 * consistente entre la home y el chat vacío. Single source of truth.
 *
 * onSend acepta los 4 args (text, imageBase64, imageMode, imageEngine) y los
 * propaga a AppShell.handleHomeSend → useChat.sendMessage. De esta forma los
 * quick actions de generación de imagen funcionan desde la home.
 */
export function HomePage({ userName, onSend, onNavigate: _onNavigate }: Props) {
  return (
    <EmptyState
      agent="kira"
      userName={userName}
      onSend={onSend}
      loading={false}
    />
  );
}
