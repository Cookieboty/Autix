import type { ChatAttachmentInput } from '../chat-attachments';

export type PromptAction = 'chat' | 'image';

export interface AcquiredItem {
  resourceType: 'SKILL' | 'MCP' | 'AGENT';
  resourceId: string;
  resource?: { id?: string; title?: string };
}

export interface ChatPromptSourceImage {
  url: string;
  prompt?: string;
}

export interface ChatPromptActiveTemplate {
  id: string;
  title: string;
  coverImage?: string;
  variableCount: number;
  editable?: boolean;
}

export interface ChatPromptInjectValue {
  content: string;
  images?: string[];
  attachments?: ChatAttachmentInput[];
  token: number;
}
