import type { VideoNodeOverlayView } from './VideoNodeOverlay';

export type Tool = 'selection' | 'frame' | 'rectangle' | 'freedraw' | 'text' | 'eraser';
export type GenerationMode = 'image' | 'video';
export type UploadTarget = 'canvas' | 'composer';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  images?: string[];
  videos?: string[];
  pending?: boolean;
  error?: boolean;
}

export interface ComposerImage {
  id: string;
  url: string;
  name: string;
}

export interface CanvasImageRef {
  elementId: string;
  url: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CanvasImageFileSource {
  assetUrl: string;
  dataURL: string;
}

export interface CopiedCanvasImage {
  url: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CanvasImageNodeView extends CanvasImageRef {
  screenX: number;
  screenY: number;
  screenWidth: number;
  screenHeight: number;
}

export interface SelectionInfo extends CanvasImageRef {
  screenX: number;
  screenY: number;
  zoom: number;
  assetUrl: string | null;
}

export interface AppStateLike {
  activeTool?: { type?: string };
  zoom?: { value?: number };
  scrollX?: number;
  scrollY?: number;
  selectedElementIds?: Record<string, boolean>;
}

export type Tr = {
  (key: string, values?: Record<string, string | number>): string;
  has?: (key: string) => boolean;
};

export interface VideoLinkEditorInfo {
  id: string;
  screenX: number;
  screenY: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  path: string;
  role: 'sequence' | 'input';
  prompt: string;
  hasPromptField: boolean;
  order?: number;
  plainLabel?: string;
}

export type VideoLinkLabelInfo = VideoLinkEditorInfo;

export interface CanvasConnectionTarget {
  id: string;
  kind: 'image' | 'video';
  x: number;
  y: number;
}

export interface CanvasConnectionDrag {
  sourceId: string;
  sourceX: number;
  sourceY: number;
  pointerX: number;
  pointerY: number;
  target: CanvasConnectionTarget | null;
}

export interface CanvasConnectionHandlesProps {
  images: CanvasImageNodeView[];
  videos: VideoNodeOverlayView[];
  drag: CanvasConnectionDrag | null;
  onStartConnection: (sourceId: string, point: { x: number; y: number }) => void;
}
