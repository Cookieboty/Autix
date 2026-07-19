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
    const pointsRepo = { findHoldById: vi.fn().mockResolvedValue(hold) };
    const service = new PointsHoldService(pointsRepo as never, {} as never);
    const warnSpy = vi.spyOn((service as unknown as { logger: { warn: (m: string) => void } }).logger, 'warn');

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
    const pointsRepo = { findHoldById: vi.fn().mockResolvedValue(hold) };
    const service = new PointsHoldService(pointsRepo as never, {} as never);
    const warnSpy = vi.spyOn((service as unknown as { logger: { warn: (m: string) => void } }).logger, 'warn');

    const result = await service.quoteHoldFromSnapshot('hold-1', {});

    expect(result).toBe(60);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('returns the total unchanged and does not warn when the quote exactly equals the frozen amount', async () => {
    const hold = buildHold({ estimatedAmount: 100, pricingSnapshot: buildSnapshot(constSchema(100)) });
    const pointsRepo = { findHoldById: vi.fn().mockResolvedValue(hold) };
    const service = new PointsHoldService(pointsRepo as never, {} as never);
    const warnSpy = vi.spyOn((service as unknown as { logger: { warn: (m: string) => void } }).logger, 'warn');

    const result = await service.quoteHoldFromSnapshot('hold-1', {});

    expect(result).toBe(100);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('throws BadRequestException when the hold does not exist', async () => {
    const pointsRepo = { findHoldById: vi.fn().mockResolvedValue(null) };
    const service = new PointsHoldService(pointsRepo as never, {} as never);

    await expect(service.quoteHoldFromSnapshot('missing', {})).rejects.toMatchObject({
      i18nKey: 'points.hold_not_found',
    });
  });

  it('propagates parsePricingSnapshot rejection for an old-engine-shaped snapshot instead of falling back to re-estimation', async () => {
    const hold = buildHold({ pricingSnapshot: { ruleId: 'rule-1', taskType: 'image_generation' } });
    const pointsRepo = { findHoldById: vi.fn().mockResolvedValue(hold) };
    const service = new PointsHoldService(pointsRepo as never, {} as never);

    await expect(service.quoteHoldFromSnapshot('hold-1', {})).rejects.toThrow(BadRequestException);
  });

  it('reads through the provided transaction client when given, not through findHoldById', async () => {
    const hold = buildHold({});
    const findHoldByIdWithinTx = vi.fn().mockResolvedValue(hold);
    const findHoldById = vi.fn();
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
    const pointsRepo = { findHoldById: vi.fn().mockResolvedValue(hold) };
    const service = new PointsHoldService(pointsRepo as never, {} as never);

    const result = await service.quoteHoldFromSnapshot('hold-1', {});

    expect(Number.isInteger(result)).toBe(true);
  });

  it('rejects a usage key that collides with a frozen params key (anti-tampering, spec §3.1.1.65)', async () => {
    // 结算不能篡改下单参数。usage.quality 与 params.quality 撞名——旧实现是"静默忽略
    // usage"，新规则(§3.1.1.65 的 merge)是"撞名即抛错"，因为一个结算调用试图重述
    // 下单参数，本身就是调用方 bug，该炸出来而不是悄悄用冻结值。
    // estimatedAmount 刻意设得远高于两种取值(90/350)，确保这里失败的原因是碰撞抛错，
    // 而不是被封顶逻辑夹到 500 掩盖。
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
    const pointsRepo = { findHoldById: vi.fn().mockResolvedValue(hold) };
    const service = new PointsHoldService(pointsRepo as never, {} as never);

    await expect(service.quoteHoldFromSnapshot('hold-1', { quality: 'high' })).rejects.toThrow();
  });

  it('prices from the frozen params when usage carries only non-colliding settlement keys', async () => {
    // 正常路径：usage 只带结算量(此 schema 不用 token，用一个不撞名的键)，
    // 模型侧价格完全来自快照冻结的 params，usage 不参与模型侧求值。
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
    const pointsRepo = { findHoldById: vi.fn().mockResolvedValue(hold) };
    const service = new PointsHoldService(pointsRepo as never, {} as never);

    const result = await service.quoteHoldFromSnapshot('hold-1', { outputTokens: 999 });

    expect(result).toBe(90);
  });
});
