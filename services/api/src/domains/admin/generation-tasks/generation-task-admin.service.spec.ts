import { GenerationTaskAdminService } from './generation-task-admin.service';

describe('GenerationTaskAdminService', () => {
  it('列表结果里绝不能出现全部 6 个敏感列', async () => {
    // repository 的 select 已经不取这些列，但 service 层再做一次断言式过滤，
    // 防止将来有人改 select 时把敏感字段带出去。mock item 把全部 6 个敏感键都塞上
    // 真实值，确保每个断言都有实际的红/绿信号（而不是因为 mock 里压根没这个键而恒真）。
    const repo = {
      list: vi.fn().mockResolvedValue({
        items: [
          {
            id: 't-1',
            promptLength: 12,
            prompt: '不该出现',
            paramsSnapshot: { seed: 1 },
            upstreamBody: '不该出现',
            upstreamDiagnostics: { trace: 'x' },
            errorMessage: '不该出现',
            billingError: '不该出现',
          },
        ],
        nextCursor: null,
      }),
      findDetail: vi.fn(),
    };
    const service = new GenerationTaskAdminService(repo as never);

    const result = await service.list({ limit: 20 } as never);

    expect(result.items[0]).not.toHaveProperty('prompt');
    expect(result.items[0]).not.toHaveProperty('paramsSnapshot');
    expect(result.items[0]).not.toHaveProperty('upstreamBody');
    expect(result.items[0]).not.toHaveProperty('upstreamDiagnostics');
    expect(result.items[0]).not.toHaveProperty('errorMessage');
    expect(result.items[0]).not.toHaveProperty('billingError');
    expect(result.items[0].promptLength).toBe(12);
  });

  it('详情返回完整字段（含敏感内容）—— 它挂的是更高一级的权限', async () => {
    const repo = {
      list: vi.fn(),
      findDetail: vi.fn().mockResolvedValue({
        task: { id: 't-1', prompt: '一只猫', upstreamBody: '{"e":1}', billingStatus: 'CONFIRMED' },
        hold: { id: 'h-1' },
        pointsRecords: [],
      }),
    };
    const service = new GenerationTaskAdminService(repo as never);

    const detail = await service.getDetail('t-1');

    expect(detail.task.prompt).toBe('一只猫');
    expect(detail.task.upstreamBody).toBe('{"e":1}');
  });

  it('详情查不到时抛 NotFound，而不是返回 null', async () => {
    const service = new GenerationTaskAdminService({
      list: vi.fn(),
      findDetail: vi.fn().mockResolvedValue(null),
    } as never);
    await expect(service.getDetail('missing')).rejects.toThrow();
  });

  it('billingStatus=CONFIRMED 但查不到 hold（脏数据/历史数据）时，用 dataInconsistent 标记出来，而不是静默返回空数组', async () => {
    const repo = {
      list: vi.fn(),
      findDetail: vi.fn().mockResolvedValue({
        task: { id: 't-2', billingStatus: 'CONFIRMED' },
        hold: null,
        pointsRecords: [],
      }),
    };
    const service = new GenerationTaskAdminService(repo as never);

    const detail = await service.getDetail('t-2');

    expect(detail.dataInconsistent).toBe(true);
  });

  it('billingStatus 非 CONFIRMED 且无 hold 时是正常状态，不标记 dataInconsistent', async () => {
    const repo = {
      list: vi.fn(),
      findDetail: vi.fn().mockResolvedValue({
        task: { id: 't-3', billingStatus: 'PENDING' },
        hold: null,
        pointsRecords: [],
      }),
    };
    const service = new GenerationTaskAdminService(repo as never);

    const detail = await service.getDetail('t-3');

    expect(detail.dataInconsistent).toBe(false);
  });
});
