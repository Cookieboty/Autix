import { BadRequestException } from '@nestjs/common';
import { PointsHoldService } from './points-hold.service';

/**
 * These tests deliberately exercise the *real* quoteTaskFromSnapshot from
 * @autix/domain/pricing rather than mocking it. Mocking the whole
 * '@autix/domain/pricing' module (as an earlier draft of this suite did) also wipes
 * out validatePricingSchema, which parsePricingSnapshot needs to validate the
 * snapshot's modelSchema/taskFixedSchema — every test would then blow up with
 * "validatePricingSchema is not a function" before quoteHoldFromSnapshot even got
 * to the part under test. Driving the real pricing math end-to-end is also a
 * stronger test: an implementation that merges `usage` into `params` before
 * calling quoteTaskFromSnapshot (letting settlement override the frozen quality)
 * would only be caught by actually running the schema evaluator, not by asserting
 * a mock was called with certain arguments.
 */

const constSchema = (value: number) => ({ terms: [{ id: 'base', op: 'add', const: value }] });

function buildSnapshot(modelSchema: ReturnType<typeof constSchema>) {
  return {
    schemaVersion: 1,
    modelConfigId: 'model-1',
    modelSchema,
    taskFixedSchema: null,
    multiplier: 1,
    discountFactor: 1,
    discountCode: null,
    params: {},
  };
}

function buildHold(input: { estimatedAmount?: number; pricingSnapshot?: unknown } = {}) {
  return {
    id: 'hold-1',
    estimatedAmount: input.estimatedAmount ?? 100,
    pricingSnapshot: input.pricingSnapshot ?? buildSnapshot(constSchema(60)),
  };
}

describe('PointsHoldService.quoteHoldFromSnapshot', () => {
  it('caps the quoted total at the frozen estimatedAmount and warns with raw, frozen, and usage', async () => {
    const hold = buildHold({ estimatedAmount: 100, pricingSnapshot: buildSnapshot(constSchema(150)) });
    const pointsRepo = { findHoldById: jest.fn().mockResolvedValue(hold) };
    const service = new PointsHoldService(pointsRepo as never, {} as never);
    const warnSpy = jest.spyOn((service as unknown as { logger: { warn: (m: string) => void } }).logger, 'warn');

    const result = await service.quoteHoldFromSnapshot('hold-1', { outputTokens: 500 });

    expect(result).toBe(100);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const message = warnSpy.mock.calls[0][0] as string;
    expect(message).toContain('hold-1');
    expect(message).toContain('150');
    expect(message).toContain('100');
    expect(message).toContain('outputTokens');
    expect(message).toContain('500');
  });

  it('returns the quoted total unchanged when under the frozen amount (no flooring to the frozen amount)', async () => {
    const hold = buildHold({ estimatedAmount: 100, pricingSnapshot: buildSnapshot(constSchema(60)) });
    const pointsRepo = { findHoldById: jest.fn().mockResolvedValue(hold) };
    const service = new PointsHoldService(pointsRepo as never, {} as never);
    const warnSpy = jest.spyOn((service as unknown as { logger: { warn: (m: string) => void } }).logger, 'warn');

    const result = await service.quoteHoldFromSnapshot('hold-1', {});

    expect(result).toBe(60);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('returns the total unchanged and does not warn when the quote exactly equals the frozen amount', async () => {
    const hold = buildHold({ estimatedAmount: 100, pricingSnapshot: buildSnapshot(constSchema(100)) });
    const pointsRepo = { findHoldById: jest.fn().mockResolvedValue(hold) };
    const service = new PointsHoldService(pointsRepo as never, {} as never);
    const warnSpy = jest.spyOn((service as unknown as { logger: { warn: (m: string) => void } }).logger, 'warn');

    const result = await service.quoteHoldFromSnapshot('hold-1', {});

    expect(result).toBe(100);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('throws BadRequestException when the hold does not exist', async () => {
    const pointsRepo = { findHoldById: jest.fn().mockResolvedValue(null) };
    const service = new PointsHoldService(pointsRepo as never, {} as never);

    await expect(service.quoteHoldFromSnapshot('missing', {})).rejects.toThrow(BadRequestException);
  });

  it('propagates parsePricingSnapshot rejection for an old-engine-shaped snapshot instead of falling back to re-estimation', async () => {
    const hold = buildHold({ pricingSnapshot: { ruleId: 'rule-1', taskType: 'image_generation' } });
    const pointsRepo = { findHoldById: jest.fn().mockResolvedValue(hold) };
    const service = new PointsHoldService(pointsRepo as never, {} as never);

    await expect(service.quoteHoldFromSnapshot('hold-1', {})).rejects.toThrow(BadRequestException);
  });

  it('reads through the provided transaction client when given, not through findHoldById', async () => {
    const hold = buildHold({});
    const findHoldByIdWithinTx = jest.fn().mockResolvedValue(hold);
    const findHoldById = jest.fn();
    const pointsRepo = { findHoldByIdWithinTx, findHoldById };
    const service = new PointsHoldService(pointsRepo as never, {} as never);
    const tx = {} as never;

    const result = await service.quoteHoldFromSnapshot('hold-1', {}, tx);

    expect(findHoldByIdWithinTx).toHaveBeenCalledWith(tx, 'hold-1');
    expect(findHoldById).not.toHaveBeenCalled();
    expect(result).toBe(60);
  });

  it('the returned value is always an integer', async () => {
    const hold = buildHold({ estimatedAmount: 100, pricingSnapshot: buildSnapshot(constSchema(150)) });
    const pointsRepo = { findHoldById: jest.fn().mockResolvedValue(hold) };
    const service = new PointsHoldService(pointsRepo as never, {} as never);

    const result = await service.quoteHoldFromSnapshot('hold-1', {});

    expect(Number.isInteger(result)).toBe(true);
  });

  it('does not let a usage key that collides with a frozen params key change the model-side price', async () => {
    // modelSchema 只读 params（来自快照），不读 usage——usage.quality 和 params.quality
    // 撞名不该影响结果。故意把 estimatedAmount 设得远高于两种取值下的价格，避免封顶
    // 逻辑掩盖掉"usage 覆盖了 params"这个 bug：如果 quoteHoldFromSnapshot 在调用
    // quoteTaskFromSnapshot 前把 usage 合并进了 params，quality 会从 medium(90) 变成
    // high(350)，350 仍然小于 estimatedAmount(500)，不会被夹到 500，bug 会原样暴露。
    const snapshot = {
      schemaVersion: 1,
      modelConfigId: 'model-1',
      modelSchema: {
        terms: [
          { id: 'base', op: 'add', const: 1 },
          { id: 'quality', op: 'mul', table: { param: 'quality', values: { medium: 90, high: 350 } } },
        ],
      },
      taskFixedSchema: null,
      multiplier: 1,
      discountFactor: 1,
      discountCode: null,
      params: { quality: 'medium' },
    };
    const hold = buildHold({ estimatedAmount: 500, pricingSnapshot: snapshot });
    const pointsRepo = { findHoldById: jest.fn().mockResolvedValue(hold) };
    const service = new PointsHoldService(pointsRepo as never, {} as never);

    const result = await service.quoteHoldFromSnapshot('hold-1', { quality: 'high' });

    expect(result).toBe(90);
  });
});
