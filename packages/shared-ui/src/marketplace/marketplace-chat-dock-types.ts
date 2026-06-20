import type { Dispatch, RefObject, SetStateAction } from 'react';
import type {
  AnyResource,
  ChatAttachment,
  ResourceType,
  StreamMessage,
  TemplateVariable,
} from '@autix/shared-store';
import type { LocalChatAttachment } from '../chat/chat-attachments';
import type { ImageResultItem } from '../chat/MessageBubble';
import type { FrameSlot, VideoMaterial } from '../video/VideoInputArea';
import type { VideoGenMode } from '../video/VideoToolbar';

export interface MarketplaceChatDockProps {
  template: AnyResource | null;
  resourceType: ResourceType;
  onClose: () => void;
}

export interface DockMessage {
  role: 'user' | 'assistant';
  content: string;
  metadata?: {
    images?: string[];
    attachments?: ChatAttachment[];
  };
  messageType?: StreamMessage['messageType'];
  payload?: unknown;
  isStreaming?: boolean;
  timestamp?: Date;
}

export interface SourceImageRef {
  url: string;
  prompt?: string;
  generationId?: string;
  index?: number;
}

export interface TemplateWithPrompt {
  prompt?: string;
  variables?: TemplateVariable[];
  coverImage?: string;
  exampleImages?: string[];
  exampleMedia?: string[];
  modelHint?: string;
  durationSec?: number;
  defaultParams?: {
    ratio?: string;
    resolution?: string;
    generateAudio?: boolean;
    mode?: string;
  };
}

export type ImageGenerationRequest = {
  promptOverride?: string;
  editInstruction?: string;
  sourceImages?: SourceImageRef[];
  inputImages?: string[];
};

export interface MarketplaceChatDockVideoInput {
  mode: VideoGenMode;
  setMode: (mode: VideoGenMode) => void;
  model: string;
  setModel: (model: string) => void;
  ratio: string;
  setRatio: (ratio: string) => void;
  duration: number;
  setDuration: (duration: number) => void;
  materials: VideoMaterial[];
  frames: FrameSlot[];
  applyRefs: (refs: string[], targetMode?: VideoGenMode) => void;
  resetInputsForTemplateMode: (targetMode: VideoGenMode, refs?: string[]) => void;
  clearInputs: () => void;
  addMaterials: (files: File[]) => void;
  removeMaterial: (id: string) => void;
  addFrame: () => void;
  removeFrame: (id: string) => void;
  clearFrames: () => void;
  swapFirstLastFrames: () => void;
  setFrameFile: (frameId: string, files: File[]) => void;
  pasteFiles: (files: File[]) => void;
}

export interface MarketplaceChatDockController {
  template: AnyResource;
  tpl: AnyResource & TemplateWithPrompt;
  resourceType: ResourceType;
  onClose: () => void;
  messages: DockMessage[];
  messagesEndRef: RefObject<HTMLDivElement | null>;
  isStreaming: boolean;
  error: string | null;
  sessionId: string | null;
  promptDialogOpen: boolean;
  setPromptDialogOpen: Dispatch<SetStateAction<boolean>>;
  varValues: Record<string, string>;
  selectedRefs: string[];
  selectedSourceImages: SourceImageRef[];
  injectValue:
    | { content: string; images?: string[]; token: number }
    | undefined;
  imageSize: string;
  setImageSize: Dispatch<SetStateAction<string>>;
  imageQuality: string;
  setImageQuality: Dispatch<SetStateAction<string>>;
  imageCount: number;
  setImageCount: Dispatch<SetStateAction<number>>;
  variables: TemplateVariable[];
  referenceImages: string[];
  hasTemplateEditor: boolean;
  isImageTemplate: boolean;
  isVideoTemplate: boolean;
  videoInput: MarketplaceChatDockVideoInput;
  handleSend: (content: string, attachments?: LocalChatAttachment[]) => Promise<void>;
  handleGenerateImage: (payload?: ImageGenerationRequest) => Promise<void>;
  handleGenerateImageFromInput: (
    instruction?: string,
    attachments?: LocalChatAttachment[],
  ) => Promise<void>;
  toggleSourceImage: (image: ImageResultItem) => void;
  removeSourceImage: (index: number) => void;
  clearSourceImages: () => void;
  reapplyTemplate: () => void;
  handleTemplateApply: (
    composed: string,
    values: Record<string, string>,
    refs: string[],
  ) => void;
}
