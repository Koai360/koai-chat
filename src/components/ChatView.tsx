import { useState, useEffect, useRef, useCallback } from "react";
import { MessageBubble, StreamingBubble } from "./MessageBubble";
import { ChatInput } from "./ChatInput";
import type { Conversation, Agent, Message } from "../hooks/useChat";

interface Props {
  conversation: Conversation | null;
  agent: Agent;
  loading: boolean;
  loadingHint?: string | null;
  streamingText: string;
  onSend: (text: string, imageBase64?: string, imageMode?: boolean, imageEngine?: string) => void;
  onTranscribe: (blob: Blob) => Promise<string>;
  onDelete?: (id: string) => void;
  onDeleteMessages?: (conversationId: string, messageIds: string[]) => void;
  userName?: string;
  onImageClick?: (imageSrc: string) => void;
}

function getGreeting(name?: string): string {
  const hour = new Date().getHours();
  const displayName = name || "Usuario";
  if (hour < 12) return `Buenos días, ${displayName}`;
  if (hour < 18) return `Buenas tardes, ${displayName}`;
  return `Buenas noches, ${displayName}`;
}

function getSuggestions(agent: Agent): string[] {
  const hour = new Date().getHours();

  if (agent === "kronos") {
    return [
      "Estado del sistema",
      "Resumen de la arquitectura",
      "Qué endpoints tiene la API?",
    ];
  }

  if (hour < 12) {
    return [
      "Qué tengo pendiente hoy?",
      "Resumen de mensajes nuevos",
      "Cotizar stickers personalizados",
    ];
  }
  if (hour < 18) {
    return [
      "Estado de los pedidos",
      "Genera una imagen para un post",
      "Cotizar stickers personalizados",
    ];
  }
  return [
    "Resumen de lo que se hizo hoy",
    "Qué quedó pendiente?",
    "Programa una tarea para mañana",
  ];
}

function formatDateLabel(timestamp: number): string {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Hoy";
  if (date.toDateString() === yesterday.toDateString()) return "Ayer";
  return date.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" });
}

function shouldShowDate(messages: Message[], index: number): boolean {
  if (index === 0) return true;
  const prev = new Date(messages[index - 1].timestamp).toDateString();
  const curr = new Date(messages[index].timestamp).toDateString();
  return prev !== curr;
}

export function ChatView({ conversation, agent, loading, loadingHint, streamingText, onSend, onTranscribe, onDelete, onDeleteMessages, userName, onImageClick }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const [showMenu, setShowMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const menuRef = useRef<HTMLDivElement>(null);

  // Track if user is near bottom
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const threshold = 120;
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  }, []);

  // Auto-scroll only if near bottom
  useEffect(() => {
    if (!isNearBottomRef.current) return;
    const isMobile = window.innerWidth < 768;
    bottomRef.current?.scrollIntoView({ behavior: isMobile ? "auto" : "smooth" });
  }, [conversation?.messages.length, streamingText]);

  // Force scroll to bottom on conversation switch
  useEffect(() => {
    isNearBottomRef.current = true;
    bottomRef.current?.scrollIntoView({ behavior: "auto" });
  }, [conversation?.id]);

  // Exit select mode when conversation changes
  useEffect(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
  }, [conversation?.id]);

  // Close menu on outside click
  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
        setConfirmDelete(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMenu]);

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

  const suggestions = getSuggestions(agent);

  return (
    <div className="flex flex-col h-full">
      {/* Header: normal mode or select mode */}
      {conversation && conversation.messages.length > 0 && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06] bg-[#212121]">
          {selectMode ? (
            <>
              <button
                onClick={() => { setSelectMode(false); setSelectedIds(new Set()); }}
                className="p-1.5 rounded-lg text-[#9b9b9b] hover:text-[#ececec] hover:bg-white/5 transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
              <span className="text-sm text-[#9b9b9b]">
                {selectedIds.size} seleccionado{selectedIds.size !== 1 ? "s" : ""}
              </span>
              <button
                onClick={handleDeleteSelected}
                disabled={selectedIds.size === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500 text-white hover:bg-red-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                </svg>
                Eliminar
              </button>
            </>
          ) : (
            <>
              <h3 className="text-sm font-medium text-[#ececec] truncate flex-1 mr-2">
                {conversation.title}
              </h3>
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => { setShowMenu(!showMenu); setConfirmDelete(false); }}
                  className="p-1.5 rounded-lg text-[#9b9b9b] hover:text-[#ececec] hover:bg-white/5 transition-colors"
                  aria-label="Opciones"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="12" cy="5" r="2" />
                    <circle cx="12" cy="12" r="2" />
                    <circle cx="12" cy="19" r="2" />
                  </svg>
                </button>
                {showMenu && (
                  <div className="absolute right-0 top-full mt-1 w-52 rounded-xl border border-white/[0.06] bg-[#2f2f2f] shadow-lg z-50 overflow-hidden animate-fade-in">
                    {!confirmDelete ? (
                      <>
                        <button
                          onClick={() => { setSelectMode(true); setShowMenu(false); }}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#ececec] hover:bg-white/5 transition-colors"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="9 11 12 14 22 4" />
                            <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                          </svg>
                          Seleccionar mensajes
                        </button>
                        <button
                          onClick={() => setConfirmDelete(true)}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                          </svg>
                          Eliminar conversación
                        </button>
                      </>
                    ) : (
                      <div className="p-3">
                        <p className="text-xs text-[#9b9b9b] mb-2">¿Eliminar esta conversación?</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => { setShowMenu(false); setConfirmDelete(false); }}
                            className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.06] text-[#9b9b9b] hover:bg-white/10 transition-colors"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={() => {
                              if (onDelete && conversation) onDelete(conversation.id);
                              setShowMenu(false);
                              setConfirmDelete(false);
                            }}
                            className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Messages */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 py-2 chat-scroll bg-[#212121]"
      >
        <div className="max-w-[48rem] mx-auto w-full">
        {!conversation || conversation.messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-8 animate-fade-in">
            <img
              src={agent === "kira" ? "/icons/kira-logo.svg" : "/icons/kronos-logo.svg"}
              alt={agent === "kira" ? "Kira" : "Kronos"}
              className="w-24 h-24 rounded-2xl mb-4"
            />
            <h2 className="text-xl font-bold text-[#ececec] mb-0.5">
              {getGreeting(userName)}
            </h2>
            <p className="text-[13px] text-[#9b9b9b] max-w-xs mb-1">
              {agent === "kira"
                ? "Soy Kira, tu asistente de KOAI Studios"
                : "Soy Kronos, arquitecto de código"}
            </p>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium mb-6 bg-[#bcd431]/10 text-[#bcd431]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#bcd431]" />
              En línea
            </div>
            <div className="flex flex-wrap justify-center gap-2 max-w-xs">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => onSend(s)}
                  disabled={loading}
                  className="px-3.5 py-2 rounded-2xl border border-white/[0.06] text-xs text-[#9b9b9b] hover:bg-[#2f2f2f] hover:text-[#ececec] hover:border-white/10 transition-all disabled:opacity-50 active:scale-95"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          conversation.messages.map((msg, i) => (
            <div key={msg.id} className={`flex items-start gap-2 ${selectMode ? "cursor-pointer" : ""}`} onClick={selectMode ? () => toggleSelect(msg.id) : undefined}>
              {selectMode && (
                <div className={`flex-shrink-0 mt-3 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                  selectedIds.has(msg.id)
                    ? "bg-red-500 border-red-500"
                    : "border-white/20"
                }`}>
                  {selectedIds.has(msg.id) && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
              )}
              <div className="flex-1 min-w-0">
                {shouldShowDate(conversation.messages, i) && (
                  <div className="date-separator text-[#9b9b9b]">
                    <span>{formatDateLabel(msg.timestamp)}</span>
                  </div>
                )}
                <MessageBubble message={msg} onImageClick={selectMode ? undefined : onImageClick} />
              </div>
            </div>
          ))
        )}

        {/* Streaming indicator */}
        {loading && streamingText && (
          <StreamingBubble text={streamingText} agent={agent} />
        )}

        {/* Typing / generating indicator — no bubble */}
        {loading && !streamingText && (
          <div className="flex gap-2.5 mb-3 animate-bubble-in">
            <img
              src={agent === "kira" ? "/icons/kira-logo.svg" : "/icons/kronos-logo.svg"}
              alt=""
              className="w-6 h-6 rounded-full flex-shrink-0 mt-0.5"
            />
            <div>
              {loadingHint ? (
                <div className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4 text-[#bcd431] flex-shrink-0" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span className="text-xs text-[#9b9b9b]">{loadingHint}</span>
                </div>
              ) : (
                <div className="flex gap-1 pt-2">
                  <span className="w-[7px] h-[7px] bg-[#9b9b9b]/50 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-[7px] h-[7px] bg-[#9b9b9b]/50 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-[7px] h-[7px] bg-[#9b9b9b]/50 rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              )}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <ChatInput
        onSend={onSend}
        onTranscribe={onTranscribe}
        disabled={loading}
        placeholder={agent === "kira" ? "Pregunta a Kira..." : "Pregunta a Kronos..."}
        autoFocus={!!conversation}
        agent={agent}
      />
    </div>
  );
}
