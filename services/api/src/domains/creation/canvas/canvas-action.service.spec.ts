import type { Mock } from 'vitest';
import { CanvasActionService } from './canvas-action.service';
import type { EstimateActionDto } from './dto/run-canvas-action.dto';

interface BuildOverrides {
  pointsService?: Partial<{ estimateCost: Mock }>;
  boardService?: Partial<{ getBoard: Mock }>;
}

function buildCanvasActionService(overrides: BuildOverrides = {}) {
  const boardService = {
    getBoard: vi.fn().mockResolvedValue({ entitlement: { canGenerate: true } }),
    loadStateById: vi.fn(),
    applyAuthoritativeMerge: vi.fn(),
    ...overrides.boardService,
  };
  const repository = {
    listActions: vi.fn(),
    findActionByIdempotencyKey: vi.fn(),
    createAction: vi.fn(),
    updateAction: vi.fn(),
  };
  const pointsService = {
    estimateCost: vi.fn(),
    ...overrides.pointsService,
  };
  const r2Service = { getPublicUrl: vi.fn() };
  const imageWorkbench = { ensureWorkbenchTemplate: vi.fn() };
  const imageFlow = { resolveImageRequest: vi.fn(), generateAndPersistImage: vi.fn() };

  const service = new CanvasActionService(
    boardService as never,
    repository as never,
    pointsService as never,
    r2Service as never,
    imageWorkbench as never,
    imageFlow as never,
  );

  return { service, boardService, repository, pointsService, r2Service, imageWorkbench, imageFlow };
}

const baseDto = (over: Partial<EstimateActionDto> = {}): EstimateActionDto =>
  ({
    actionType: 'image-generate',
    selectedNodeIds: [],
    ...over,
  }) as EstimateActionDto;

describe('CanvasActionService.estimate', () => {
  it('returns a metered estimate for agent-chat without calling the estimator', async () => {
    const estimateCost = vi.fn();
    const { service } = buildCanvasActionService({ pointsService: { estimateCost } });

    const result = await service.estimate('user-1', 'board-1', baseDto({ actionType: 'agent-chat' }));

    expect(result).toEqual({ kind: 'metered', note: '按用量计费' });
    expect(estimateCost).not.toHaveBeenCalled();
  });

  it('returns a free exact estimate for export without calling the estimator', async () => {
    const estimateCost = vi.fn();
    const { service } = buildCanvasActionService({ pointsService: { estimateCost } });

    const result = await service.estimate('user-1', 'board-1', baseDto({ actionType: 'export' }));

    expect(result).toEqual({ kind: 'exact', cost: 0 });
    expect(estimateCost).not.toHaveBeenCalled();
  });

  it('returns an exact cost from the estimator on success', async () => {
    const estimateCost = vi.fn().mockResolvedValue({ estimatedCost: 90 });
    const { service } = buildCanvasActionService({ pointsService: { estimateCost } });

    const result = await service.estimate('user-1', 'board-1', baseDto({ count: 2 }));

    expect(result).toEqual({ kind: 'exact', cost: 90 });
  });

  it('logs an error (not a warning) and returns a distinguishable metered fallback when the estimator throws', async () => {
    const estimateCost = vi.fn().mockRejectedValue(new Error('missing default binding'));
    const { service } = buildCanvasActionService({ pointsService: { estimateCost } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const logger = (service as any).logger;
    const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);

    const result = await service.estimate('user-1', 'board-1', baseDto());

    expect(result.kind).toBe('metered');
    // Must read distinctly from the genuinely-metered agent-chat branch ('按用量计费').
    expect((result as { note: string }).note).not.toBe('按用量计费');
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const [loggedMessage] = errorSpy.mock.calls[0] as [string];
    expect(loggedMessage).toContain('image_generation');
    expect(loggedMessage).toContain('missing default binding');
  });

  it('passes modelConfigId through when provided, and params instead of quantity', async () => {
    const estimateCost = vi.fn().mockResolvedValue({ estimatedCost: 90 });
    const { service } = buildCanvasActionService({ pointsService: { estimateCost } });

    await service.estimate('user-1', 'board-1', baseDto({ modelConfigId: 'model-1', count: 2 }));

    expect(estimateCost).toHaveBeenCalledWith({
      taskType: 'image_generation',
      modelConfigId: 'model-1',
      params: { quantity: 2 },
    });
  });

  it('omits modelConfigId when the dto does not carry one', async () => {
    const estimateCost = vi.fn().mockResolvedValue({ estimatedCost: 90 });
    const { service } = buildCanvasActionService({ pointsService: { estimateCost } });

    await service.estimate('user-1', 'board-1', baseDto());

    expect(estimateCost).toHaveBeenCalledWith({
      taskType: 'image_generation',
      params: { quantity: 1 },
    });
    const [calledWith] = estimateCost.mock.calls[0] as [Record<string, unknown>];
    expect(Object.prototype.hasOwnProperty.call(calledWith, 'modelConfigId')).toBe(false);
  });
});
