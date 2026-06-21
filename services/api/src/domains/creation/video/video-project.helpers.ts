import {
  VideoClipStatus,
  VideoGenStatus,
  type Prisma,
} from '../../platform/prisma/generated';

export interface VideoTemplateClipCreateInput {
  order: number;
  title?: string | null;
  prompt?: string | null;
  params: Prisma.InputJsonValue;
  chainFromPrev?: boolean;
  status: Prisma.video_clipsUncheckedCreateInput['status'];
}

export interface WorkflowTemplateClipDefinitionInput {
  title?: string | null;
  promptTemplate?: string | null;
  defaultParams?: unknown;
  chainFromPrevious?: boolean;
}

interface TemplateVariableDefinition {
  key?: unknown;
  default?: unknown;
}

export const projectDetailInclude = {
  clips: {
    orderBy: { order: 'asc' },
    include: {
      materials: true,
      generations: {
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
    },
  },
} satisfies Prisma.video_projectsInclude;

export const userGeneratedProjectsListInclude = {
  clips: {
    orderBy: { order: 'asc' },
    include: {
      materials: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      generations: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          id: true,
          clipId: true,
          projectId: true,
          userId: true,
          variantLabel: true,
          model: true,
          resolvedPrompt: true,
          params: true,
          seedanceTaskId: true,
          status: true,
          videoUrl: true,
          lastFrameUrl: true,
          thumbnailUrl: true,
          durationSec: true,
          error: true,
          externalStatus: true,
          createdAt: true,
          completedAt: true,
        },
      },
    },
  },
} satisfies Prisma.video_projectsInclude;

export function buildUserGeneratedProjectsWhere(
  userId: string,
): Prisma.video_projectsWhereInput {
  return {
    userId,
    clips: {
      some: {
        generations: {
          some: {},
        },
      },
    },
  };
}

export function buildPageResult<T>(input: {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  skip: number;
}) {
  return {
    items: input.items,
    total: input.total,
    page: input.page,
    pageSize: input.pageSize,
    hasMore: input.skip + input.items.length < input.total,
  };
}

export function resolveNextClipOrder(aggregate: {
  _max: { order: number | null };
}): number {
  return (aggregate._max.order ?? 0) + 1;
}

export function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return { ...(value as Record<string, unknown>) };
}

export function normalizeClipParams(
  params: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...params };
  if (next.generateAudio === undefined && next.generate_audio !== undefined) {
    next.generateAudio = next.generate_audio;
  }
  delete next.generate_audio;
  return next;
}

export function normalizeClipRecordParams<T extends { params: unknown }>(
  clip: T,
): Omit<T, 'params'> & { params: Record<string, unknown> } {
  return {
    ...clip,
    params: normalizeClipParams(toRecord(clip.params)),
  };
}

export function resolveTemplateVariables(
  variableDefs: unknown,
  variables?: Record<string, string>,
): Record<string, string> {
  const defaults: Record<string, string> = {};
  if (Array.isArray(variableDefs)) {
    for (const item of variableDefs as TemplateVariableDefinition[]) {
      if (typeof item?.key !== 'string') continue;
      if (item.default == null) continue;
      defaults[item.key] = String(item.default);
    }
  }
  return { ...defaults, ...(variables ?? {}) };
}

export function resolvePrompt(
  prompt: string,
  values: Record<string, string>,
): string {
  return prompt.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (match, key: string) => {
    const value = values[key.trim()];
    return value == null ? match : value;
  });
}

export function buildSingleClipParams(
  defaultParams: unknown,
  durationSec?: number | null,
  variables?: Record<string, string>,
): Record<string, unknown> {
  const templateParams = toRecord(defaultParams);
  const variableDuration = Number(variables?.duration);
  const paramsDuration = Number(templateParams.duration);
  const duration =
    (Number.isFinite(variableDuration) && variableDuration > 0
      ? variableDuration
      : undefined) ||
    (Number.isFinite(paramsDuration) && paramsDuration > 0
      ? paramsDuration
      : undefined) ||
    durationSec ||
    5;

  return {
    ratio: '16:9',
    resolution: '1080p',
    generateAudio: true,
    ...templateParams,
    duration,
  };
}

export function buildWorkflowTemplateClips(input: {
  clipDefs: WorkflowTemplateClipDefinitionInput[];
  variables?: Record<string, string>;
  defaultVideoModelId?: string;
}): VideoTemplateClipCreateInput[] {
  return input.clipDefs.map((clipDef, index) => {
    let prompt = clipDef.promptTemplate ?? '';
    if (input.variables) {
      for (const [key, value] of Object.entries(input.variables)) {
        prompt = prompt.replaceAll(`{{${key}}}`, value);
      }
    }

    const params = normalizeClipParams({
      ...((clipDef.defaultParams ?? {}) as Record<string, unknown>),
    });
    if (!params.modelConfigId && input.defaultVideoModelId !== undefined) {
      params.modelConfigId = input.defaultVideoModelId;
    }

    return {
      order: index + 1,
      title: clipDef.title,
      prompt,
      params: params as Prisma.InputJsonValue,
      chainFromPrev: clipDef.chainFromPrevious,
      status: VideoClipStatus.pending,
    };
  });
}
