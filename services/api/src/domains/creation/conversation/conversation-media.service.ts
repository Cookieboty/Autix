import { Injectable } from '@nestjs/common';
import { Prisma } from '../../platform/prisma/generated';
import { ConversationRepository } from './conversation.repository';

@Injectable()
export class ConversationMediaService {
  constructor(private readonly repository: ConversationRepository) {}

  async listImages(conversationId: string, limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;
    const safeLimit =
      parsedLimit && Number.isFinite(parsedLimit) && parsedLimit > 0
        ? Math.min(parsedLimit, 500)
        : 200;

    const rows = await this.repository.findAssistantImageMessages(
      conversationId,
      safeLimit,
    );

    const items: Array<{
      messageId: string;
      createdAt: Date;
      url: string;
      prompt?: string;
      generationId?: string;
    }> = [];

    for (const row of rows) {
      const metadata = this.asRecord(row.metadata);
      if (!metadata || metadata.messageType !== 'image_result') continue;
      const images = Array.isArray(metadata.images) ? metadata.images : [];
      for (const image of images) {
        if (!image || typeof image !== 'object') continue;
        const imageRecord = image as Record<string, unknown>;
        const url = typeof imageRecord.url === 'string' ? imageRecord.url : undefined;
        if (!url) continue;
        items.push({
          messageId: row.id,
          createdAt: row.createdAt,
          url,
          prompt: typeof imageRecord.prompt === 'string' ? imageRecord.prompt : undefined,
          generationId:
            typeof metadata.generationId === 'string'
              ? metadata.generationId
              : undefined,
        });
      }
    }

    return { items, total: items.length };
  }

  listStepArtifacts(runId: string) {
    return this.repository.findStepArtifactsByRun(runId);
  }

  async findVideoProjectId(conversationId: string, userId: string) {
    const project = await this.repository.findVideoProjectIdForUser(
      conversationId,
      userId,
    );
    return project?.id ?? null;
  }

  private asRecord(value: Prisma.JsonValue | null): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }
}
