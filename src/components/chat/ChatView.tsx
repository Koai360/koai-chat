import { useState, useEffect, useRef, useCallback } from "react";
import { MessageBubble, StreamingBubble } from "./MessageBubble";
import { ChatInput } from "./ChatInput";
import { SelectModeHeader } from "./ChatHeader";
import { EmptyState } from "./EmptyState";
import { TypingIndicator } from "./TypingIndicator";
import { DateSeparator, formatDateLabel, shouldShowDate } from "./DateSeparator";
import type { Conversation, Agent } from "@/hooks/useChat";

interface Props {
  conversation: Conversation | null;
  agent: Agent;
  loading: boolean;
  loadingHint?: string | null;
  streamingText: string;
  onSend: (text: string, imageBase64?: string, imageMode?: boolean, imageEngine?: string, editMode?: boolean) => void;
  onTranscribe: (blob: Blob) => Promise<string>;
  onDelete?: (id: string) => void;
  onDeleteMessages?: (conversationId: string, messageIds: string[]) => void;
  userName?: string;
  onImageClick?: (imageSrc: string) => void;
  selectMode?: boolean;
  onSelectMode?: (active: boolean) => void;
}

export function ChatView({ conversation, agent, loading, loadingHint, streamingText, onSend, onTranscribe, onDelete: _onDelete, onDeleteMessages, userName, onImageClick, selectMode: externalSelectMode, onSelectMode }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const [internalSelectMode, setInternalSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const selectMode = externalSelectMode ?? internalSelectMode;
  const setSelectMode = onSelectMode ?? setInternalSelectMode;

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }, []);

  useEffect(() => {
    if (!isNearBottomRef.current) return;
    const isMobile = window.innerWidth < 768;
    bottomRef.current?.scrollIntoView({ behavior: isMobile ? "auto" : "smooth" });
  }, [conversation?.messages.length, streamingText]);

  useEffect(() => {
    isNearBottomRef.current = true;
    bottomRef.current?.scrollIntoView({ behavior: "auto" });
  }, [conversation?.id]);

  useEffect(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
  }, [conversation?.id]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDeleteSelected = () => {
    if (onDeleteMessages && conversation && selectedIds.size > 0) {
      onDeleteMessages(conversation.id, Array.from(selectedIds));
    }
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  return (
    <div className="flex flex-col h-full bg-bg">
      {/* Select mode header (shown inline when selecting) */}
      {selectMode && conversation && conversation.messages.length > 0 && (
        <SelectModeHeader
          count={selectedIds.size}
          onCancel={() => { setSelectMode(false); setSelectedIds(new Set()); }}
          onDeleteSelected={handleDeleteSelected}
        />
      )}

      {/* Messages */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 py-2"
      >
        <div className={`max-w-[48rem] mx-auto w-full ${!conversation || conversation.messages.length === 0 ? "h-full" : ""}`}>
          {!conversation || conversation.messages.length === 0 ? (
            <EmptyState
              agent={agent}
              userName={userName}
              onSend={onSend}
              loading={loading}
            />
          ) : (
            conversation.messages.map((msg, i) => (
              <div
                key={msg.id}
                className={selectMode ? "cursor-pointer" : ""}
                onClick={selectMode ? () => toggleSelect(msg.id) : undefined}
              >
                {selectMode && (
                  <div className="flex items-start gap-2">
                    <div className={`shrink-0 mt-3 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                      selectedIds.has(msg.id)
                        ? "bg-danger border-danger"
                        : "border-border"
                    }`}>
                      {selectedIds.has(msg.id) && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                  </div>
                )}
                {shouldShowDate(conversation.messages, i) && (
                  <DateSeparator label={formatDateLabel(msg.timestamp)} />
                )}
                <MessageBubble
                  message={msg}
                  conversationId={conversation.id}
                  onImageClick={selectMode ? undefined : onImageClick}
                  isLast={!selectMode && msg.role === "assistant" && i === conversation.messages.length - 1}
                  onRegenerate={!selectMode && msg.role === "assistant" && i === conversation.messages.length - 1 && !loading
                    ? () => {
                        const lastUserMsg = [...conversation.messages].reverse().find((m) => m.role === "user");
                        if (lastUserMsg) onSend(lastUserMsg.content);
                      }
                    : undefined
                  }
                />
              </div>
            ))
          )}

          {/* Streaming */}
          {loading && streamingText && (
            <StreamingBubble text={streamingText} agent={agent} />
          )}

          {/* Typing indicator */}
          {loading && !streamingText && (
            <TypingIndicator agent={agent} loadingHint={loadingHint} />
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input — in-flow al final del flex column. Cuando el teclado
          abre, el layout viewport se achica y el input se pega al borde
          superior del teclado naturalmente. */}
      <ChatInput
        onSend={onSend}
        onTranscribe={onTranscribe}
        disabled={loading}
        placeholder={agent === "kira" ? "Pregunta algo a Kira..." : "Pregunta algo a Kronos..."}
        autoFocus={!!conversation}
        agent={agent}
      />
    </div>
  );
}
