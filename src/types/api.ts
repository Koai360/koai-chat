/**
 * Tipos del backend API koai-api.
 * Mapean a los modelos Pydantic de /opt/koai-api/api/routes/chat*.py.
 */

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  title: string | null;
  agent: string;
  created_at: string;
  updated_at: string;
  message_count?: number;
  last_message_at?: string | null;
}

export type MessageRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  image?: string | null;
  engine?: string | null;
  created_at: string;
}

export interface ChatImage {
  id: string;
  url: string;
  prompt?: string;
  engine?: string;
  /** Pixel width — backend lo guarda al subir imagen (S136). Null para imágenes legacy. */
  width?: number | null;
  /** Pixel height — backend lo guarda al subir imagen (S136). Null para imágenes legacy. */
  height?: number | null;
  created_at: string;
  rating?: 0 | 1 | 2 | 3 | 4 | 5;
  hidden?: boolean;
}

export interface UserMemory {
  id: string;
  user_id: string;
  type: string;
  content: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export type ThinkingLevel = "minimal" | "low" | "medium" | "high";

export interface SendMessagePayload {
  message: string;
  conversation_id?: string;
  workspace_id?: string;
  agent?: string;
  thinking_level?: ThinkingLevel;
  image_base64?: string;
  image_mode?: boolean;
  image_engine?: string;
  edit_mode?: boolean;
  image_url?: string;
  file_base64?: string;
  file_name?: string;
  file_type?: string;
}
