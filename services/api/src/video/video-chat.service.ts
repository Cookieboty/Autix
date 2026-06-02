import { Injectable } from '@nestjs/common';
import { ModelType, VideoClipStatus } from '../prisma/generated';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ModelConfigService } from '../model-config/model-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { createChatModelFromDbConfig } from '../llm/model.factory';
import type { WorkflowStepEvent } from '../llm/workflow/workflow.types';

export interface VideoChatInput {
  userId: string;
  conversationId: string;
  message: string;
  projectId: string;
  modelConfigId?: string;
}

const SYSTEM_PROMPT = `You are an AI Video Director assistant. Your job is to help the user plan and create video clips.

You understand the user's creative intent and help them:
1. Write prompts for each clip (scene descriptions, camera movements, mood)
2. Suggest materials (first frame images, last frame images, style references, reference videos, audio)
3. Choose video generation parameters (duration, resolution, aspect ratio, native audio)
4. Plan multi-clip sequences for storytelling

The available video generation model supports text-to-video, image-to-video,
first/last frame control, reference images, reference video, reference audio,
720p/1080p resolution, common aspect ratios, return_last_frame, and generate_audio.

When the user describes a video they want to create, respond with structured JSON wrapped in <video_action> tags:

<video_action>
{
  "action": "clip_suggestion" | "update_prompt" | "update_params" | "ready_to_generate",
  "clipOrder": 1,
  "title": "...",
  "prompt": "...",
  "params": { "duration": 5, "ratio": "16:9", "resolution": "1080p", "generate_audio": true },
  "reasoning": "..."
}
</video_action>

If the user's message is conversational or unclear, respond with plain text guidance.
Always respond in the same language the user uses.`;

type ParsedVideoAction = {
  action?: string;
  clipOrder?: number;
  title?: string;
  prompt?: string;
  params?: Record<string, unknown>;
  reasoning?: string;
};

@Injectable()
export class VideoChatService {
  constructor(
    private readonly modelConfigService: ModelConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async *chat(input: VideoChatInput): AsyncGenerator<WorkflowStepEvent> {
    const text = await this.invokeAssistant(input);
    const parsed = this.parseVideoAction(text);

    if (parsed) {
      const content = await this.applyVideoAction(input, parsed);
      yield {
        type: 'llm_token',
        stepKey: 'video_chat',
        content,
      };
      return;
    }

    yield { type: 'llm_token', stepKey: 'video_chat', content: text };
  }

  private async invokeAssistant(input: VideoChatInput): Promise<string> {
    const config = input.modelConfigId
      ? await this.modelConfigService.getConfigForOrchestrator(input.modelConfigId)
      : await this.modelConfigService.findDefaultByType(ModelType.general);
    if (!config) throw new Error('未配置通用模型');

    const history = await this.prisma.messages.findMany({
      where: { conversationId: input.conversationId },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });

    const project = await this.prisma.video_projects.findFirst({
      where: { conversationId: input.conversationId },
      include: {
        clips: { orderBy: { order: 'asc' }, include: { materials: true } },
      },
    });

    const projectContext = project
      ? this.buildProjectContext(project)
      : 'No project created yet.';

    const model = createChatModelFromDbConfig(config);

    const historyLines = history
      .slice(-10)
      .map((m) => `${m.role}: ${m.content.slice(0, 500)}`)
      .join('\n');

    const result = await model.invoke([
      new SystemMessage(SYSTEM_PROMPT),
      new HumanMessage(
        [
          `Current project state:\n${projectContext}`,
          historyLines ? `Recent conversation:\n${historyLines}` : '',
          `User message: ${input.message}`,
        ]
          .filter(Boolean)
          .join('\n\n'),
      ),
    ]);

    return typeof result.content === 'string'
      ? result.content
      : JSON.stringify(result.content);
  }

  private buildProjectContext(project: {
    title: string;
    clips: Array<{
      order: number;
      title: string | null;
      prompt: string | null;
      params: unknown;
      status: string;
      materials: Array<{ role: string; url: string; name: string | null }>;
    }>;
  }): string {
    const lines = [`Project: ${project.title}`, `Clips: ${project.clips.length}`];

    for (const clip of project.clips) {
      const materials = clip.materials
        .map((m) => `${m.role}: ${m.name ?? m.url.slice(-20)}`)
        .join(', ');
      lines.push(
        `  Clip ${clip.order}: "${clip.title ?? 'untitled'}" [${clip.status}] prompt="${clip.prompt ?? ''}" materials=[${materials}]`,
      );
    }

    return lines.join('\n');
  }

  private async applyVideoAction(
    input: VideoChatInput,
    action: ParsedVideoAction,
  ): Promise<string> {
    const actionName = action.action ?? 'clip_suggestion';
    const prompt =
      typeof action.prompt === 'string' && action.prompt.trim()
        ? action.prompt.trim()
        : undefined;
    const params =
      action.params && typeof action.params === 'object' && !Array.isArray(action.params)
        ? action.params
        : undefined;
    const title =
      typeof action.title === 'string' && action.title.trim()
        ? action.title.trim()
        : undefined;
    const clipOrder =
      typeof action.clipOrder === 'number' && Number.isFinite(action.clipOrder)
        ? Math.max(1, Math.floor(action.clipOrder))
        : await this.nextClipOrder(input.projectId);

    const shouldUpsert =
      actionName === 'clip_suggestion' ||
      actionName === 'update_prompt' ||
      actionName === 'update_params' ||
      Boolean(prompt) ||
      Boolean(params);

    let changed = false;
    if (shouldUpsert) {
      const existing = await this.prisma.video_clips.findFirst({
        where: { projectId: input.projectId, order: clipOrder },
      });

      if (existing) {
        const existingParams =
          existing.params && typeof existing.params === 'object' && !Array.isArray(existing.params)
            ? (existing.params as Record<string, unknown>)
            : {};
        await this.prisma.video_clips.update({
          where: { id: existing.id },
          data: {
            ...(title ? { title } : {}),
            ...(prompt ? { prompt } : {}),
            ...(params ? { params: { ...existingParams, ...params } as object } : {}),
          },
        });
      } else {
        await this.prisma.video_clips.create({
          data: {
            projectId: input.projectId,
            order: clipOrder,
            title: title ?? `镜头 ${clipOrder}`,
            prompt: prompt ?? '',
            params: (params ?? {
              duration: 5,
              ratio: '16:9',
              resolution: '1080p',
              generate_audio: true,
            }) as object,
            chainFromPrev: false,
            status: VideoClipStatus.pending,
          },
        });
      }
      changed = true;
    }

    const lines = [
      changed
        ? `已更新第 ${clipOrder} 个片段。`
        : `已整理第 ${clipOrder} 个片段的创作建议。`,
    ];
    if (prompt) lines.push(`Prompt：${prompt}`);
    if (params) lines.push(`参数：${JSON.stringify(params)}`);
    if (action.reasoning) lines.push(`说明：${action.reasoning}`);
    lines.push(
      actionName === 'ready_to_generate'
        ? '当前片段可以生成。你也可以先补充首帧、参考图、参考视频或音频素材。'
        : '你可以继续让我拆分镜头、调整参数，或在片段卡片里点击生成视频。',
    );
    return lines.join('\n');
  }

  private async nextClipOrder(projectId: string): Promise<number> {
    const agg = await this.prisma.video_clips.aggregate({
      where: { projectId },
      _max: { order: true },
    });
    return (agg._max.order ?? 0) + 1;
  }

  private parseVideoAction(text: string): ParsedVideoAction | null {
    const match = text.match(/<video_action>\s*([\s\S]*?)\s*<\/video_action>/);
    if (!match) return null;

    try {
      return JSON.parse(match[1]) as ParsedVideoAction;
    } catch {
      return null;
    }
  }
}
