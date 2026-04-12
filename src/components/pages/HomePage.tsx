import { EmptyState } from "@/components/chat/EmptyState";
import { ChatInput } from "@/components/chat/ChatInput";
import { transcribeAudio } from "@/lib/api";
import type { Page } from "@/hooks/useNavigation";

interface Props {
  userName: string;
  onSend: (text: string, imageBase64?: string, imageMode?: boolean, imageEngine?: string, editMode?: boolean, imageUrl?: string) => void;
  onNavigate: (page: Page) => void;
}

/**
 * HomePage — pantalla de inicio cuando el usuario abre la app.
 *
 * Layout: [EmptyState scrollable con quick actions] + [ChatInput in-flow]
 *
 * El ChatInput vive aquí directamente (no en ChatView) para que el user
 * pueda escribir desde home sin tener que crear una conversación primero.
 * handleHomeSend en AppShell se encarga de crear la convo + navegar +
 * enviar cuando el user escribe algo.
 *
 * Los quick actions del EmptyState también terminan llamando a onSend
 * con imageMode/imageEngine, así los shortcuts de imagen funcionan igual.
 */
export function HomePage({ userName, onSend, onNavigate: _onNavigate }: Props) {
  return (
    <div className="flex flex-col h-full bg-bg">
      {/* Quick actions + greeting — scrollable */}
      <div className="flex-1 overflow-y-auto px-3 py-2 min-h-0">
        <div className="max-w-[48rem] mx-auto w-full h-full">
          <EmptyState
            agent="noa"
            userName={userName}
            onSend={onSend}
            loading={false}
          />
        </div>
      </div>

      {/* Input in-flow (mismo approach que ChatView) */}
      <ChatInput
        onSend={onSend}
        onTranscribe={transcribeAudio}
        placeholder="Pregunta algo a Noa..."
        agent="noa"
      />
    </div>
  );
}
