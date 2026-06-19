export type ConversationKind = 'chat' | 'video' | 'image' | 'avatar';

export type ChatAttachmentKind = 'image' | 'video' | 'audio' | 'file';

export interface ChatAttachment {
  url: string;
  name: string;
  mimeType: string;
  size: number;
  kind: ChatAttachmentKind;
}

export interface ConversationAgentRef {
  id: string;
  name: string;
  kind: ConversationKind;
}

export interface ConversationProjectMeta {
  projectId: string;
  status: string;
  clipCount: number;
}

export interface Conversation {
  id: string;
  title: string;
  kind: ConversationKind;
  agentId: string | null;
  agent: ConversationAgentRef | null;
  projectMeta: ConversationProjectMeta | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationVideoProjectMeta {
  id: string;
  title: string;
  status: string;
  coverImage: string | null;
  clipCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationDetail {
  id: string;
  userId: string;
  title: string;
  kind: ConversationKind;
  agentId: string | null;
  agent: ConversationAgentRef | null;
  videoProject: ConversationVideoProjectMeta | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationMessage {
  id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  createdAt: string;
  messageType?: string;
  uiResponse?: unknown;
  thinking?: string;
  metadata?: Record<string, unknown>;
}

export interface ConversationSourceImage {
  url: string;
  prompt?: string;
  generationId?: string;
  index?: number;
}

export interface ConversationImageItem {
  messageId: string;
  createdAt: string;
  url: string;
  prompt?: string;
  generationId?: string;
}

export interface ConversationImagesResponse {
  items: ConversationImageItem[];
  total: number;
}
