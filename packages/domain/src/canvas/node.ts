// Creative Canvas — node & asset-reference contracts.
//
// Zero-dependency rule applies (see ./board). Nodes store STABLE asset
// references; `resolvedUrl`/`resolvedThumbnailUrl` are hydrated by GET
// endpoints and must never be persisted as canonical truth.

export type CanvasNodeKind =
  | 'text'
  | 'prompt'
  | 'image'
  | 'video'
  | 'material'
  | 'mask'
  | 'storyboardClip'
  | 'generationTask'
  | 'workflow'
  | 'group'
  | 'note';

export interface CanvasNodeBase {
  id: string;
  kind: CanvasNodeKind;
  title?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  zIndex?: number;
  locked?: boolean;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

/**
 * Stable pointer to a persisted asset. The board JSON stores this; the
 * backend resolves a fresh accessible URL at load time. Never store a
 * presigned URL in the snapshot.
 */
export type CanvasAssetRef =
  | {
      type: 'material_asset';
      materialId: string;
      storageKey?: string | null;
    }
  | {
      type: 'image_generation';
      generationId: string;
      index?: number;
      storageKey?: string | null;
    }
  | {
      type: 'video_generation';
      projectId?: string;
      clipId?: string;
      generationId: string;
      storageKey?: string | null;
    }
  | {
      type: 'upload';
      storageKey: string;
      mimeType?: string | null;
    }
  | {
      type: 'external';
      url: string;
      trustLevel: 'user_added' | 'system_seeded';
    };

export interface TextCanvasNode extends CanvasNodeBase {
  kind: 'text';
  text: string;
}

export interface NoteCanvasNode extends CanvasNodeBase {
  kind: 'note';
  text: string;
  color?: string | null;
}

export interface PromptCanvasNode extends CanvasNodeBase {
  kind: 'prompt';
  prompt: string;
  negativePrompt?: string;
  settings?: {
    modelId?: string;
    size?: string;
    quality?: string;
    stylePreset?: string;
    ratio?: string;
    duration?: number;
    [key: string]: unknown;
  };
}

export interface ImageCanvasNode extends CanvasNodeBase {
  kind: 'image';
  assetRef: CanvasAssetRef;
  // Hydrated by GET /canvas-boards/:id/state. Never persist as canonical truth.
  resolvedUrl?: string | null;
  resolvedThumbnailUrl?: string | null;
  prompt?: string | null;
}

export interface VideoCanvasNode extends CanvasNodeBase {
  kind: 'video';
  assetRef: CanvasAssetRef;
  // Hydrated by GET /canvas-boards/:id/state. Never persist as canonical truth.
  resolvedUrl?: string | null;
  resolvedThumbnailUrl?: string | null;
  durationSec?: number | null;
}

export interface MaterialCanvasNode extends CanvasNodeBase {
  kind: 'material';
  assetRef: CanvasAssetRef;
  resolvedUrl?: string | null;
  resolvedThumbnailUrl?: string | null;
  materialType?: string | null;
}

export interface MaskCanvasNode extends CanvasNodeBase {
  kind: 'mask';
  /** Mask stored as a stable ref or inline data; targets an image node. */
  targetNodeId: string;
  assetRef?: CanvasAssetRef;
  maskDataUrl?: string | null;
}

export interface StoryboardClipCanvasNode extends CanvasNodeBase {
  kind: 'storyboardClip';
  order: number;
  prompt: string;
  durationSec: number;
  startFrameNodeId?: string;
  endFrameNodeId?: string;
  videoProjectId?: string;
  videoClipId?: string;
}

export type CanvasGenerationTaskStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'expired';

/**
 * Optimistic placeholder for an in-flight generation. Reconciled with the
 * server result via `clientPlaceholderId` (never by position or recency).
 */
export interface GenerationTaskCanvasNode extends CanvasNodeBase {
  kind: 'generationTask';
  clientPlaceholderId: string;
  actionId?: string | null;
  taskStatus: CanvasGenerationTaskStatus;
  progress?: number | null;
  error?: string | null;
  /** True after the user deletes the placeholder while the task runs on. */
  hiddenPlaceholder?: boolean;
}

export interface WorkflowCanvasNode extends CanvasNodeBase {
  kind: 'workflow';
  workflowId?: string | null;
}

export interface GroupCanvasNode extends CanvasNodeBase {
  kind: 'group';
  childNodeIds: string[];
}

export type CanvasNode =
  | TextCanvasNode
  | NoteCanvasNode
  | PromptCanvasNode
  | ImageCanvasNode
  | VideoCanvasNode
  | MaterialCanvasNode
  | MaskCanvasNode
  | StoryboardClipCanvasNode
  | GenerationTaskCanvasNode
  | WorkflowCanvasNode
  | GroupCanvasNode;

/** Node kinds that carry a resolvable asset reference. */
export const ASSET_BEARING_NODE_KINDS: ReadonlySet<CanvasNodeKind> = new Set([
  'image',
  'video',
  'material',
]);

export interface CanvasGroup {
  id: string;
  title?: string;
  nodeIds: string[];
  metadata?: Record<string, unknown>;
}
