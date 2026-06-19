export interface VideoWorkflowClipDefinition {
  order: number;
  title?: string;
  promptTemplate: string;
  defaultParams: Record<string, unknown>;
  materialSlots?: Array<{
    role: string;
    required: boolean;
    label: string;
    maxCount?: number;
  }>;
  chainFromPrevious: boolean;
}

export interface VideoWorkflowTemplate {
  id: string;
  title: string;
  description?: string | null;
  category: string;
  coverImage?: string | null;
  tags: string[];
  clips: VideoWorkflowClipDefinition[];
  pointsCost: number;
  status: string;
  authorId: string;
  useCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface VideoDirectorTemplateContext {
  templateId: string;
  templateKind: 'workflow' | 'standard';
  title: string;
  category?: string | null;
  description?: string | null;
  prompt?: string;
  defaultParams?: Record<string, unknown> | null;
  tags?: string[];
  clips?: Array<{
    order: number;
    title?: string;
    promptTemplate: string;
    defaultParams: Record<string, unknown>;
    chainFromPrevious: boolean;
  }>;
}

export interface VideoGenerationRecord {
  id: string;
  clipId: string;
  projectId: string;
  userId: string;
  status: string;
  seedanceTaskId?: string | null;
  videoUrl?: string | null;
  lastFrameUrl?: string | null;
  thumbnailUrl?: string | null;
  durationSec?: number | null;
  error?: string | null;
  externalStatus?: string | null;
  createdAt: string;
  completedAt?: string | null;
}
