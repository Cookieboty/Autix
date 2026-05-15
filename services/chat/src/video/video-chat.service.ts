import { Injectable } from '@nestjs/common';
import { ModelType } from '../prisma/generated';
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
2. Suggest materials (first frame images, style references, audio)
3. Choose parameters (duration, resolution, aspect ratio)
4. Plan multi-clip sequences for storytelling

When the user describes a video they want to create, respond with structured JSON wrapped in <video_action> tags:

<video_action>
{
  "action": "clip_suggestion" | "update_prompt" | "update_params" | "ready_to_generate",
  "clipOrder": 1,
  "prompt": "...",
  "params": { "duration": 5, "ratio": "16:9", "resolution": "1080p" },
  "reasoning": "..."
}
</video_action>

If the user's message is conversational or unclear, respond with plain text guidance.
Always respond in the same language the user uses.`;

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
      yield {
        type: 'llm_token',
        stepKey: 'video_chat',
        content: JSON.stringify(parsed),
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

  private parseVideoAction(
    text: string,
  ): Record<string, unknown> | null {
    const match = text.match(/<video_action>\s*([\s\S]*?)\s*<\/video_action>/);
    if (!match) return null;

    try {
      return JSON.parse(match[1]) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}
