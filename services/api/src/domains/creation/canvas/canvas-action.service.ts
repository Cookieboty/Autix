import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import {
  type CanvasActionEstimate,
  type CanvasBoardState,
  buildCanvasSelectionContext,
  createGeneratedImageNodes,
  mergeGeneratedResult,
  placeGeneratedNodesNearSource,
} from '@autix/domain';
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
import type { EstimateActionDto, ImageGenerateActionDto } from './dto/run-canvas-action.dto';

@Injectable()
export class CanvasActionService {
  private readonly logger = new Logger(CanvasActionService.name);

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
      return { kind: 'metered', note: '按用量计费' };
    }
    if (dto.actionType === 'export') {
      return { kind: 'exact', cost: 0 };
    }
    try {
      const result = await this.pointsService.estimateCost({
        taskType: IMAGE_GENERATION_TASK_TYPE,
        quantity: dto.count ?? 1,
      });
      return { kind: 'exact', cost: result.estimatedCost };
    } catch (error) {
      this.logger.warn(`estimate failed, falling back to metered: ${String(error)}`);
      return { kind: 'metered', note: '无法预估，按实际用量计费' };
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
      throw new ForbiddenException(entitlement.reason ?? '该功能需要开通会员');
    }

    // Idempotency: replay the recorded action instead of regenerating/charging.
    const existing = await this.repository.findActionByIdempotencyKey(boardId, dto.idempotencyKey);
    if (existing) return existing;

    const state = await this.boardService.loadStateById(userId, boardId);
    const ctx = buildCanvasSelectionContext(state, dto.selectedNodeIds);
    const promptNode = ctx.prompts[0];
    if (!promptNode) throw new BadRequestException('needs_prompt');

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
