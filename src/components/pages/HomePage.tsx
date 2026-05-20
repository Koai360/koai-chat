import { EmptyState } from "@/components/chat/EmptyState";
import { ChatInput } from "@/components/chat/ChatInput";
import { transcribeAudio } from "@/lib/api";
import type { Page } from "@/hooks/useNavigation";

interface Props {
  userName: string;
  loading?: boolean;
  onSend: (text: string, imageBase64?: string, imageMode?: boolean, imageEngine?: string, editMode?: boolean, imageUrl?: string) => void;
  onStop?: () => void;
  onNavigate: (page: Page) => void;
}

/**
 * HomePage — pantalla de inicio cuando el usuario abre la app.
 *
 * Layout: [EmptyState scrollable con quick actions] + [ChatInput in-flow]
 *
 * El ChatInput vive aquí directamente (no en ChatView) para que el user
 * pueda escribir desde home sin tener que crear una conversación primero.
 * handleHomeSend en AppShell se encarga de navegar + enviar (sendMessage
 * crea la convo internamente si no existe).
 */
export function HomePage({ userName, loading = false, onSend, onStop, onNavigate: _onNavigate }: Props) {
  return (
    <div className="flex flex-col h-full bg-bg">
      {/* Quick actions + greeting — scrollable */}
      <div className="flex-1 overflow-y-auto px-3 py-2 min-h-0">
        <div className="max-w-[48rem] mx-auto w-full h-full">
          <EmptyState
            userName={userName}
            onSend={onSend}
            loading={loading}
          />
        </div>
      </div>

      {/* Input in-flow (mismo approach que ChatView) */}
      <ChatInput
        onSend={onSend}
        onStop={onStop}
        loading={loading}
        onTranscribe={transcribeAudio}
        placeholder="Pregunta algo a Noa..."
      />
    </div>
  );
}
