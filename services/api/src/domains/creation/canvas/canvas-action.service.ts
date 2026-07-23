import {
  ForbiddenException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { I18nHttpException } from '../../platform/i18n/i18n-http.exception';
import { AppLogger } from '../../platform/common/app-logger';
import {
  type CanvasActionEstimate,
  type CanvasBoardState,
  buildCanvasSelectionContext,
  createGeneratedImageNodes,
  mergeGeneratedResult,
  placeGeneratedNodesNearSource,
} from '@autix/domain';
import { Prisma } from '../../platform/prisma/generated';
import { PointsService } from '../../billing/points/points.service';
import { CloudflareR2Service } from '../../platform/storage/cloudflare-r2.service';
import { ImageWorkbenchService } from '../image-gen/image-workbench.service';
import {
  ImageGenerationFlowService,
} from '../llm/workflow/image-generation-flow.service';
import { IMAGE_GENERATION_TASK_TYPE } from '../llm/workflow/image-generation-flow.holds';
import type { SourceImageRef } from '../llm/workflow/image-generation-call-params';
import { CanvasBoardService } from './canvas-board.service';
import { CanvasBoardRepository } from './canvas-board.repository';
import type {
  ChatGenerateActionDto,
  EstimateActionDto,
  ImageGenerateActionDto,
} from './dto/run-canvas-action.dto';

export interface CanvasChatGeneratedImage {
  url: string;
  generationId: string;
  index: number;
  prompt: string;
}

@Injectable()
export class CanvasActionService {
  private readonly logger = new AppLogger(CanvasActionService.name);

  constructor(
    private readonly boardService: CanvasBoardService,
    private readonly repository: CanvasBoardRepository,
    private readonly pointsService: PointsService,
    private readonly r2Service: CloudflareR2Service,
    private readonly imageWorkbench: ImageWorkbenchService,
    private readonly imageFlow: ImageGenerationFlowService,
  ) {}

  listActions(userId: string, boardId: string, status?: string) {
    // Ownership is enforced by the controller via board lookup elsewhere;
    // actions are scoped by boardId which the caller already owns.
    return this.repository.listActions(boardId, status);
  }

  /** Dry-run cost preview. Never creates a hold. */
  async estimate(userId: string, boardId: string, dto: EstimateActionDto): Promise<CanvasActionEstimate> {
    await this.boardService.getBoard(userId, boardId); // ownership guard
    if (dto.actionType === 'agent-chat') {
      return { kind: 'metered', note: 'Billed by usage' };
    }
    if (dto.actionType === 'export') {
      return { kind: 'exact', cost: 0 };
    }
    try {
      const result = await this.pointsService.estimateCost({
        taskType: IMAGE_GENERATION_TASK_TYPE,
        ...(dto.modelConfigId ? { modelConfigId: dto.modelConfigId } : {}),
        params: { quantity: dto.count ?? 1 },
      });
      return { kind: 'exact', cost: result.estimatedCost };
    } catch (error) {
      // A thrown error here means real misconfiguration (missing task_definitions
      // row, no default binding, null pricingSchema) — not "this action is
      // inherently metered" like the agent-chat branch above. This endpoint charges
      // nothing (it's a preview), so falling back to a display-only metered hint is
      // safe, but the failure itself must be loud for operators.
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `canvas estimate misconfigured for taskType=${IMAGE_GENERATION_TASK_TYPE}: ${message}`,
      );
      return { kind: 'metered', note: 'Pricing config error; temporarily billed by actual usage' };
    }
  }

  /**
   * Generate an image from a selected prompt (+ optional reference images).
   * Billing hold/confirm/refund is owned by ImageGenerationFlowService — this
   * layer only records the action and merges the result authoritatively.
   */
  async imageGenerate(userId: string, boardId: string, dto: ImageGenerateActionDto) {
    const { entitlement } = await this.boardService.getBoard(userId, boardId);
    if (!entitlement.canGenerate) {
      throw new ForbiddenException(entitlement.reason ?? 'This feature requires an active membership');
    }

    // Idempotency: replay the recorded action instead of regenerating/charging.
    const existing = await this.repository.findActionByIdempotencyKey(boardId, dto.idempotencyKey);
    if (existing) return existing;

    const state = await this.boardService.loadStateById(userId, boardId);
    const ctx = buildCanvasSelectionContext(state, dto.selectedNodeIds);
    const promptNode = ctx.prompts[0];
    if (!promptNode) {
      throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'creation.canvas.needs_prompt', undefined, {
        data: { errorCode: 'needs_prompt' },
      });
    }

    const referenceImages = await this.buildReferenceImages(state, dto.selectedNodeIds);

    const action = await this.repository.createAction({
      boardId,
      userId,
      actionType: 'image-generate',
      status: 'running',
      idempotencyKey: dto.idempotencyKey,
      inputNodeIds: dto.selectedNodeIds,
      placeholderNodeIds: [dto.clientPlaceholderId],
      request: { modelConfigId: dto.modelConfigId, count: dto.count ?? 1 },
    });

    try {
      const templateId = await this.imageWorkbench.ensureWorkbenchTemplate(userId);
      const input = {
        userId,
        templateId,
        modelConfigId: dto.modelConfigId,
        promptOverride: promptNode.prompt,
        referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
      };
      const request = await this.imageFlow.resolveImageRequest(input);
      const result = await this.imageFlow.generateAndPersistImage(input, request, dto.count ?? 1);

      const placements = placeGeneratedNodesNearSource(
        state,
        dto.selectedNodeIds,
        result.images.length,
      );
      const now = new Date().toISOString();
      const { nodes, edges } = createGeneratedImageNodes({
        results: result.images.map((img) => ({
          url: img.url,
          generationId: img.generationId,
          index: img.index,
          prompt: img.prompt,
        })),
        placements,
        sourceNodeIds: dto.selectedNodeIds,
        createdAt: now,
        makeNodeId: (i) => `img_${action.id}_${i}`,
        makeEdgeId: (i) => `edge_${action.id}_${i}`,
      });

      let mapping;
      const merged = await this.boardService.applyAuthoritativeMerge(
        boardId,
        (current: CanvasBoardState, nextRevision: number) => {
          const res = mergeGeneratedResult(current, {
            nodes,
            edges,
            clientPlaceholderId: dto.clientPlaceholderId,
            boardRevision: nextRevision,
          });
          mapping = res.mapping;
          return res.state;
        },
      );

      const updated = await this.repository.updateAction(action.id, {
        status: 'completed',
        outputNodeIds: nodes.map((n) => n.id),
        result: {
          boardRevision: merged.boardRevision,
          placeholderMapping: mapping ?? null,
          nodeIds: nodes.map((n) => n.id),
        },
      });
      return updated;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`canvas image-generate failed: ${message}`);
      await this.repository.updateAction(action.id, { status: 'failed', error: message });
      throw error;
    }
  }

  /**
   * Chat-driven image generation. Returns image URLs for the frontend to
   * place on the Excalidraw scene. Billing is owned by the flow service.
   */
  async chatGenerate(
    userId: string,
    boardId: string,
    dto: ChatGenerateActionDto,
  ): Promise<{ actionId: string; images: CanvasChatGeneratedImage[] }> {
    const { entitlement } = await this.boardService.getBoard(userId, boardId);
    if (!entitlement.canGenerate) {
      throw new ForbiddenException(entitlement.reason ?? 'This feature requires an active membership');
    }

    const existing = await this.repository.findActionByIdempotencyKey(boardId, dto.idempotencyKey);
    if (existing?.status === 'completed') {
      const cached = (existing.result as { images?: CanvasChatGeneratedImage[] } | null)?.images ?? [];
      return { actionId: existing.id, images: cached };
    }

    const prompt = dto.prompt.trim();
    if (!prompt) {
      throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'creation.canvas.needs_prompt', undefined, {
        data: { errorCode: 'needs_prompt' },
      });
    }

    const referenceImages: SourceImageRef[] = (dto.referenceImageUrls ?? [])
      .filter((url) => Boolean(url))
      .map((url) => ({ url }));

    const action =
      existing ??
      (await this.repository.createAction({
        boardId,
        userId,
        actionType: 'agent-chat',
        status: 'running',
        idempotencyKey: dto.idempotencyKey,
        request: { prompt, modelConfigId: dto.modelConfigId, count: dto.count ?? 1 },
      }));

    try {
      const templateId = await this.imageWorkbench.ensureWorkbenchTemplate(userId);
      const input = {
        userId,
        templateId,
        modelConfigId: dto.modelConfigId,
        promptOverride: prompt,
        referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
      };
      const request = await this.imageFlow.resolveImageRequest(input);
      const result = await this.imageFlow.generateAndPersistImage(input, request, dto.count ?? 1);

      const images: CanvasChatGeneratedImage[] = result.images.map((img) => ({
        url: img.url,
        generationId: img.generationId,
        index: img.index,
        prompt: img.prompt,
      }));

      await this.repository.updateAction(action.id, {
        status: 'completed',
        result: { images } as unknown as Prisma.InputJsonValue,
      });
      return { actionId: action.id, images };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`canvas chat-generate failed: ${message}`);
      await this.repository.updateAction(action.id, { status: 'failed', error: message });
      throw error;
    }
  }

  private async buildReferenceImages(
    state: CanvasBoardState,
    selectedNodeIds: string[],
  ): Promise<SourceImageRef[]> {
    const ctx = buildCanvasSelectionContext(state, selectedNodeIds);
    const refs: SourceImageRef[] = [];
    for (const image of ctx.images) {
      const ref = image.assetRef;
      let url = image.resolvedUrl ?? null;
      if (!url && 'storageKey' in ref && ref.storageKey) {
        url = await this.r2Service.getPublicUrl(ref.storageKey);
      } else if (!url && ref.type === 'external') {
        url = ref.url;
      }
      if (!url) continue;
      refs.push({
        url,
        generationId: ref.type === 'image_generation' ? ref.generationId : undefined,
        index: ref.type === 'image_generation' ? ref.index : undefined,
      });
    }
    return refs;
  }
}
