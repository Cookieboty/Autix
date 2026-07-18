import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PricingConfigAdminService } from './pricing-config-admin.service';

const VALID_FIXED_COST_SCHEMA = { terms: [{ id: 'base', op: 'add' as const, const: 1 }] };

const VALID_PRICING_SCHEMA = {
  terms: [
    { id: 'base', op: 'add' as const, const: 1 },
    { id: 'quality', op: 'mul' as const, table: { param: 'quality', values: { low: 15, high: 350 } } },
  ],
};
const VALID_PARAMS_SCHEMA = {
  type: 'object' as const,
  properties: {
    quality: { type: 'string' as const, enum: ['low', 'high'], 'x-ui': { control: 'chips' as const } },
  },
};

function buildRepo() {
  return {
    findModelConfig: vi.fn(),
    updateModelSchemas: vi.fn(),
    updateModelDescription: vi.fn(),
    listTaskDefinitions: vi.fn(),
    findTaskDefinition: vi.fn(),
    createTaskDefinition: vi.fn(),
    updateTaskDefinition: vi.fn(),
    deactivateTaskDefinition: vi.fn(),
    listTaskModelBindings: vi.fn(),
    createTaskModelBinding: vi.fn(),
    updateTaskModelBinding: vi.fn(),
    deleteTaskModelBinding: vi.fn(),
    listDiscounts: vi.fn(),
    createDiscount: vi.fn(),
    updateDiscount: vi.fn(),
    deleteDiscount: vi.fn(),
  };
}

function p2002() {
  return Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
}

function p2025() {
  return Object.assign(new Error('Record not found'), { code: 'P2025' });
}

describe('PricingConfigAdminService.dryRun', () => {
  it('evaluates the given schemas against sampleParams via the real evaluator, without touching the DB', () => {
    const repo = buildRepo();
    const service = new PricingConfigAdminService(repo as never);

    const result = service.dryRun({
      paramsSchema: VALID_PARAMS_SCHEMA,
      pricingSchema: VALID_PRICING_SCHEMA,
      sampleParams: { quality: 'high' },
    });

    expect(result.total).toBe(350);
    expect(result.breakdown.map((b) => b.id)).toEqual(['base', 'quality']);
    expect(repo.updateModelSchemas).not.toHaveBeenCalled();
    expect(repo.updateModelDescription).not.toHaveBeenCalled();
  });

  it('throws 400 when the pricingSchema itself is structurally invalid, and never returns a price', () => {
    const repo = buildRepo();
    const service = new PricingConfigAdminService(repo as never);

    expect(() =>
      service.dryRun({
        paramsSchema: VALID_PARAMS_SCHEMA,
        pricingSchema: { terms: [] },
        sampleParams: {},
      }),
    ).toThrow(BadRequestException);
    expect(repo.updateModelSchemas).not.toHaveBeenCalled();
  });

  it('throws 400 when a pricing term references a param absent from paramsSchema (cross-schema integrity)', () => {
    const repo = buildRepo();
    const service = new PricingConfigAdminService(repo as never);

    try {
      service.dryRun({
        paramsSchema: { type: 'object', properties: {} },
        pricingSchema: VALID_PRICING_SCHEMA,
        sampleParams: {},
      });
      throw new Error('expected dryRun to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      const response = (err as BadRequestException).getResponse() as { violations: { code: string }[] };
      expect(response.violations.some((v) => v.code === 'PRICING_REFERENCES_UNKNOWN_PARAM')).toBe(true);
    }
  });

  it('rejects a null/non-object pricingSchema with MALFORMED_SCHEMA instead of throwing a TypeError', () => {
    const repo = buildRepo();
    const service = new PricingConfigAdminService(repo as never);

    try {
      service.dryRun({
        paramsSchema: VALID_PARAMS_SCHEMA,
        pricingSchema: null as never,
        sampleParams: {},
      });
      throw new Error('expected dryRun to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      const response = (err as BadRequestException).getResponse() as { violations: { code: string }[] };
      expect(response.violations.some((v) => v.code === 'MALFORMED_SCHEMA')).toBe(true);
    }
  });
});

describe('PricingConfigAdminService.getModel', () => {
  it('returns the model row (full description locale map + schemas) when found', async () => {
    const repo = buildRepo();
    const row = {
      id: 'm1',
      description: { en: 'A model', 'zh-CN': 'Yi ge moxing' },
      paramsSchema: VALID_PARAMS_SCHEMA,
      pricingSchema: VALID_PRICING_SCHEMA,
      schemaVersion: 3,
    };
    repo.findModelConfig.mockResolvedValue(row);
    const service = new PricingConfigAdminService(repo as never);

    await expect(service.getModel('m1')).resolves.toEqual(row);
    expect(repo.findModelConfig).toHaveBeenCalledWith('m1');
  });

  it('throws NotFoundException when the model does not exist', async () => {
    const repo = buildRepo();
    repo.findModelConfig.mockResolvedValue(null);
    const service = new PricingConfigAdminService(repo as never);

    await expect(service.getModel('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('PricingConfigAdminService.updateModelSchemas', () => {
  it('persists exactly the validated schemas (no bare-cast bypass) when both schemas are valid', async () => {
    const repo = buildRepo();
    repo.updateModelSchemas.mockResolvedValue({
      id: 'm1',
      paramsSchema: VALID_PARAMS_SCHEMA,
      pricingSchema: VALID_PRICING_SCHEMA,
      schemaVersion: 2,
    });
    const service = new PricingConfigAdminService(repo as never);

    await service.updateModelSchemas('m1', {
      paramsSchema: VALID_PARAMS_SCHEMA,
      pricingSchema: VALID_PRICING_SCHEMA,
    });

    expect(repo.updateModelSchemas).toHaveBeenCalledWith('m1', {
      paramsSchema: VALID_PARAMS_SCHEMA,
      pricingSchema: VALID_PRICING_SCHEMA,
    });
  });

  it('rejects an empty terms pricingSchema with 400 and never calls the repository', async () => {
    const repo = buildRepo();
    const service = new PricingConfigAdminService(repo as never);

    await expect(
      service.updateModelSchemas('m1', {
        paramsSchema: VALID_PARAMS_SCHEMA,
        pricingSchema: { terms: [] },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.updateModelSchemas).not.toHaveBeenCalled();
  });

  it('rejects a pricing term referencing a param absent from paramsSchema, with the specific violation code, and persists nothing', async () => {
    const repo = buildRepo();
    const service = new PricingConfigAdminService(repo as never);

    try {
      await service.updateModelSchemas('m1', {
        paramsSchema: { type: 'object', properties: {} },
        pricingSchema: VALID_PRICING_SCHEMA,
      });
      throw new Error('expected updateModelSchemas to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      const response = (err as BadRequestException).getResponse() as { violations: { code: string }[] };
      expect(response.violations.some((v) => v.code === 'PRICING_REFERENCES_UNKNOWN_PARAM')).toBe(true);
    }
    expect(repo.updateModelSchemas).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the repository reports the model as missing, without a prior update call succeeding', async () => {
    const repo = buildRepo();
    repo.updateModelSchemas.mockResolvedValue(null);
    const service = new PricingConfigAdminService(repo as never);

    await expect(
      service.updateModelSchemas('missing', {
        paramsSchema: VALID_PARAMS_SCHEMA,
        pricingSchema: VALID_PRICING_SCHEMA,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('PricingConfigAdminService.updateModelDescription', () => {
  it('rejects an unsupported locale key (cn) with 400 and persists nothing', async () => {
    const repo = buildRepo();
    const service = new PricingConfigAdminService(repo as never);

    await expect(service.updateModelDescription('m1', { cn: 'a description' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(repo.updateModelDescription).not.toHaveBeenCalled();
  });

  it('persists a supported locale key (zh-CN)', async () => {
    const repo = buildRepo();
    repo.updateModelDescription.mockResolvedValue({ id: 'm1', description: { 'zh-CN': 'a description' } });
    const service = new PricingConfigAdminService(repo as never);

    await service.updateModelDescription('m1', { 'zh-CN': 'a description' });

    expect(repo.updateModelDescription).toHaveBeenCalledWith('m1', { 'zh-CN': 'a description' });
  });

  it('throws NotFoundException when the repository reports the model as missing', async () => {
    const repo = buildRepo();
    repo.updateModelDescription.mockResolvedValue(null);
    const service = new PricingConfigAdminService(repo as never);

    await expect(
      service.updateModelDescription('missing', { 'zh-CN': 'a description' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('PricingConfigAdminService.createTaskDefinition', () => {
  it('persists a valid fixedCostSchema', async () => {
    const repo = buildRepo();
    repo.createTaskDefinition.mockResolvedValue({ taskType: 'new_task' });
    const service = new PricingConfigAdminService(repo as never);

    await service.createTaskDefinition({
      taskType: 'new_task',
      name: 'New Task',
      category: 'chat',
      fixedCostSchema: VALID_FIXED_COST_SCHEMA,
    });

    expect(repo.createTaskDefinition).toHaveBeenCalledWith({
      taskType: 'new_task',
      name: 'New Task',
      category: 'chat',
      fixedCostSchema: VALID_FIXED_COST_SCHEMA,
    });
  });

  it('persists a null fixedCostSchema without running it through validatePricingSchema', async () => {
    const repo = buildRepo();
    repo.createTaskDefinition.mockResolvedValue({ taskType: 'new_task' });
    const service = new PricingConfigAdminService(repo as never);

    await service.createTaskDefinition({
      taskType: 'new_task',
      name: 'New Task',
      category: 'image',
      fixedCostSchema: null,
    });

    expect(repo.createTaskDefinition).toHaveBeenCalledWith({
      taskType: 'new_task',
      name: 'New Task',
      category: 'image',
      fixedCostSchema: null,
    });
  });

  it('rejects an empty-terms fixedCostSchema with 400 and persists nothing', async () => {
    const repo = buildRepo();
    const service = new PricingConfigAdminService(repo as never);

    await expect(
      service.createTaskDefinition({
        taskType: 'new_task',
        name: 'New Task',
        category: 'chat',
        fixedCostSchema: { terms: [] },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.createTaskDefinition).not.toHaveBeenCalled();
  });

  it('rejects a fixedCostSchema whose first term is a mul (not unconditional const add) and persists nothing', async () => {
    const repo = buildRepo();
    const service = new PricingConfigAdminService(repo as never);

    await expect(
      service.createTaskDefinition({
        taskType: 'new_task',
        name: 'New Task',
        category: 'chat',
        fixedCostSchema: { terms: [{ id: 'base', op: 'mul', const: 1 }] },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.createTaskDefinition).not.toHaveBeenCalled();
  });

  it('translates a duplicate taskType (P2002) into ConflictException and persists nothing further', async () => {
    const repo = buildRepo();
    repo.createTaskDefinition.mockRejectedValue(p2002());
    const service = new PricingConfigAdminService(repo as never);

    await expect(
      service.createTaskDefinition({ taskType: 'dup', name: 'Dup', category: 'chat', fixedCostSchema: null }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('PricingConfigAdminService.updateTaskDefinition', () => {
  it('only forwards fields present in the patch', async () => {
    const repo = buildRepo();
    repo.updateTaskDefinition.mockResolvedValue({ taskType: 't', isActive: false });
    const service = new PricingConfigAdminService(repo as never);

    await service.updateTaskDefinition('t', { isActive: false });

    expect(repo.updateTaskDefinition).toHaveBeenCalledWith('t', { isActive: false });
  });

  it('rejects an invalid fixedCostSchema in the patch and persists nothing', async () => {
    const repo = buildRepo();
    const service = new PricingConfigAdminService(repo as never);

    await expect(service.updateTaskDefinition('t', { fixedCostSchema: { terms: [] } })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(repo.updateTaskDefinition).not.toHaveBeenCalled();
  });

  it('translates a not-found (P2025) into NotFoundException', async () => {
    const repo = buildRepo();
    repo.updateTaskDefinition.mockRejectedValue(p2025());
    const service = new PricingConfigAdminService(repo as never);

    await expect(service.updateTaskDefinition('missing', { isActive: false })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('PricingConfigAdminService.deleteTaskDefinition', () => {
  it('soft-deletes via the repository (isActive: false), never a hard delete', async () => {
    const repo = buildRepo();
    repo.deactivateTaskDefinition.mockResolvedValue({ taskType: 't', isActive: false });
    const service = new PricingConfigAdminService(repo as never);

    await service.deleteTaskDefinition('t');

    expect(repo.deactivateTaskDefinition).toHaveBeenCalledWith('t');
  });

  it('translates a not-found (P2025) into NotFoundException', async () => {
    const repo = buildRepo();
    repo.deactivateTaskDefinition.mockRejectedValue(p2025());
    const service = new PricingConfigAdminService(repo as never);

    await expect(service.deleteTaskDefinition('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('PricingConfigAdminService.createTaskModelBinding', () => {
  it('creates a binding when the model has a non-null pricingSchema', async () => {
    const repo = buildRepo();
    repo.findModelConfig.mockResolvedValue({ id: 'model-2', pricingSchema: { terms: [] } });
    repo.createTaskModelBinding.mockResolvedValue({ taskType: 'image_generation', modelConfigId: 'model-2' });
    const service = new PricingConfigAdminService(repo as never);

    await service.createTaskModelBinding({
      taskType: 'image_generation',
      modelConfigId: 'model-2',
      multiplier: 1.5,
      isDefault: false,
    });

    expect(repo.createTaskModelBinding).toHaveBeenCalledWith({
      taskType: 'image_generation',
      modelConfigId: 'model-2',
      multiplier: 1.5,
      isDefault: false,
    });
  });

  it('defaults multiplier to 1 and isDefault to false when omitted', async () => {
    const repo = buildRepo();
    repo.findModelConfig.mockResolvedValue({ id: 'model-2', pricingSchema: { terms: [] } });
    repo.createTaskModelBinding.mockResolvedValue({});
    const service = new PricingConfigAdminService(repo as never);

    await service.createTaskModelBinding({ taskType: 'image_generation', modelConfigId: 'model-2' });

    expect(repo.createTaskModelBinding).toHaveBeenCalledWith({
      taskType: 'image_generation',
      modelConfigId: 'model-2',
      multiplier: 1,
      isDefault: false,
    });
  });

  it('rejects a binding to a model whose pricingSchema is NULL and persists nothing', async () => {
    const repo = buildRepo();
    repo.findModelConfig.mockResolvedValue({ id: 'model-2', pricingSchema: null });
    const service = new PricingConfigAdminService(repo as never);

    await expect(
      service.createTaskModelBinding({ taskType: 'image_generation', modelConfigId: 'model-2' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.createTaskModelBinding).not.toHaveBeenCalled();
  });

  it('rejects a binding to a model that does not exist and persists nothing', async () => {
    const repo = buildRepo();
    repo.findModelConfig.mockResolvedValue(null);
    const service = new PricingConfigAdminService(repo as never);

    await expect(
      service.createTaskModelBinding({ taskType: 'image_generation', modelConfigId: 'missing' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.createTaskModelBinding).not.toHaveBeenCalled();
  });

  it('rejects a zero multiplier and persists nothing (never reaches the model-priceable check)', async () => {
    const repo = buildRepo();
    const service = new PricingConfigAdminService(repo as never);

    await expect(
      service.createTaskModelBinding({ taskType: 'image_generation', modelConfigId: 'model-2', multiplier: 0 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.findModelConfig).not.toHaveBeenCalled();
    expect(repo.createTaskModelBinding).not.toHaveBeenCalled();
  });

  it('rejects a negative multiplier and persists nothing', async () => {
    const repo = buildRepo();
    const service = new PricingConfigAdminService(repo as never);

    await expect(
      service.createTaskModelBinding({ taskType: 'image_generation', modelConfigId: 'model-2', multiplier: -1 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.createTaskModelBinding).not.toHaveBeenCalled();
  });

  it('translates a Prisma unique-constraint error (duplicate composite key) into ConflictException', async () => {
    const repo = buildRepo();
    repo.findModelConfig.mockResolvedValue({ id: 'model-2', pricingSchema: { terms: [] } });
    repo.createTaskModelBinding.mockRejectedValue(p2002());
    const service = new PricingConfigAdminService(repo as never);

    await expect(
      service.createTaskModelBinding({ taskType: 'image_generation', modelConfigId: 'model-2', isDefault: true }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects binding a video-protocol model to an image task', async () => {
    const repo = buildRepo();
    repo.findTaskDefinition.mockResolvedValue({ taskType: 'image_generation', category: 'image' });
    repo.findModelConfig.mockResolvedValue({
      id: 'm1',
      metadata: { protocolKey: 'ark-video@v3' },
      paramsSchema: {},
      pricingSchema: {},
    });
    const service = new PricingConfigAdminService(repo as never);

    // 改造前：保存成功，直到运行时图片 flow 调 resolveImagePreset('ark-video@v3') 才 500。
    await expect(
      service.createTaskModelBinding({ taskType: 'image_generation', modelConfigId: 'm1' }),
    ).rejects.toThrow(/媒体不匹配/);
  });

  it('accepts binding a video-protocol model to a video task', async () => {
    const repo = buildRepo();
    repo.findTaskDefinition.mockResolvedValue({ taskType: 'video_generation', category: 'video' });
    repo.findModelConfig.mockResolvedValue({
      id: 'm1',
      metadata: { protocolKey: 'ark-video@v3' },
      paramsSchema: {},
      pricingSchema: {},
    });
    repo.createTaskModelBinding.mockResolvedValue({ taskType: 'video_generation', modelConfigId: 'm1' });
    const service = new PricingConfigAdminService(repo as never);

    await expect(
      service.createTaskModelBinding({ taskType: 'video_generation', modelConfigId: 'm1' }),
    ).resolves.toBeDefined();
  });

  it('requires a protocolKey for image/video tasks', async () => {
    const repo = buildRepo();
    repo.findTaskDefinition.mockResolvedValue({ taskType: 'video_generation', category: 'video' });
    repo.findModelConfig.mockResolvedValue({ id: 'm1', metadata: {}, paramsSchema: {}, pricingSchema: {} });
    const service = new PricingConfigAdminService(repo as never);

    await expect(
      service.createTaskModelBinding({ taskType: 'video_generation', modelConfigId: 'm1' }),
    ).rejects.toThrow(/protocolKey/);
  });

  // chat / prompt 任务没有协议概念，不该被这道校验拦住。
  it('skips the media check for non-media tasks', async () => {
    const repo = buildRepo();
    repo.findTaskDefinition.mockResolvedValue({ taskType: 'chat_message_standard', category: 'chat' });
    repo.findModelConfig.mockResolvedValue({ id: 'm1', metadata: {}, paramsSchema: {}, pricingSchema: {} });
    repo.createTaskModelBinding.mockResolvedValue({ taskType: 'chat_message_standard', modelConfigId: 'm1' });
    const service = new PricingConfigAdminService(repo as never);

    await expect(
      service.createTaskModelBinding({ taskType: 'chat_message_standard', modelConfigId: 'm1' }),
    ).resolves.toBeDefined();
  });

  // 事实源是 DB 而非静态 TASK_PRESETS：后台可动态建任意 category 的任务类型。
  it('uses the DB task definition category, not the static presets', async () => {
    const repo = buildRepo();
    repo.findTaskDefinition.mockResolvedValue({ taskType: 'my_custom_video_task', category: 'video' });
    repo.findModelConfig.mockResolvedValue({
      id: 'm1',
      metadata: { protocolKey: 'openai-images@v1' },
      paramsSchema: {},
      pricingSchema: {},
    });
    const service = new PricingConfigAdminService(repo as never);

    await expect(
      service.createTaskModelBinding({ taskType: 'my_custom_video_task', modelConfigId: 'm1' }),
    ).rejects.toThrow(/媒体不匹配/);
  });
});

describe('PricingConfigAdminService.updateTaskModelBinding', () => {
  it('only forwards fields present in the patch, validating multiplier when given', async () => {
    const repo = buildRepo();
    repo.updateTaskModelBinding.mockResolvedValue({ taskType: 't', modelConfigId: 'm1', multiplier: 2 });
    const service = new PricingConfigAdminService(repo as never);

    await service.updateTaskModelBinding('t', 'm1', { multiplier: 2 });

    expect(repo.updateTaskModelBinding).toHaveBeenCalledWith('t', 'm1', { multiplier: 2 });
  });

  it('rejects a non-positive multiplier in the patch and persists nothing', async () => {
    const repo = buildRepo();
    const service = new PricingConfigAdminService(repo as never);

    await expect(service.updateTaskModelBinding('t', 'm1', { multiplier: 0 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(repo.updateTaskModelBinding).not.toHaveBeenCalled();
  });

  it('translates not-found (P2025) into NotFoundException', async () => {
    const repo = buildRepo();
    repo.updateTaskModelBinding.mockRejectedValue(p2025());
    const service = new PricingConfigAdminService(repo as never);

    await expect(service.updateTaskModelBinding('t', 'missing', { multiplier: 2 })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('PricingConfigAdminService list/delete passthroughs', () => {
  it('listTaskModelBindings forwards the optional taskType filter', async () => {
    const repo = buildRepo();
    repo.listTaskModelBindings.mockResolvedValue([]);
    const service = new PricingConfigAdminService(repo as never);

    await service.listTaskModelBindings('image_generation');

    expect(repo.listTaskModelBindings).toHaveBeenCalledWith('image_generation');
  });

  it('deleteTaskModelBinding translates not-found into NotFoundException', async () => {
    const repo = buildRepo();
    repo.deleteTaskModelBinding.mockRejectedValue(p2025());
    const service = new PricingConfigAdminService(repo as never);

    await expect(service.deleteTaskModelBinding('t', 'm1')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('PricingConfigAdminService.createDiscount', () => {
  it('persists a valid discount with defaults applied', async () => {
    const repo = buildRepo();
    repo.createDiscount.mockResolvedValue({ id: 'd1' });
    const service = new PricingConfigAdminService(repo as never);

    await service.createDiscount({
      code: 'SUMMER',
      name: '夏季活动',
      factor: 0.8,
      scope: { taskTypes: ['image_generation'] },
    });

    expect(repo.createDiscount).toHaveBeenCalledWith({
      code: 'SUMMER',
      name: '夏季活动',
      factor: 0.8,
      scope: { taskTypes: ['image_generation'] },
      stackable: false,
      priority: 0,
      effectiveFrom: null,
      effectiveTo: null,
    });
  });

  it('allows a factor greater than 1 (a surcharge)', async () => {
    const repo = buildRepo();
    repo.createDiscount.mockResolvedValue({ id: 'd1' });
    const service = new PricingConfigAdminService(repo as never);

    await service.createDiscount({ code: 'PEAK', name: '高峰加价', factor: 1.2, scope: {} });

    expect(repo.createDiscount).toHaveBeenCalledWith(
      expect.objectContaining({ factor: 1.2 }),
    );
  });

  it('rejects a zero factor and persists nothing', async () => {
    const repo = buildRepo();
    const service = new PricingConfigAdminService(repo as never);

    await expect(
      service.createDiscount({ code: 'FREE', name: 'x', factor: 0, scope: {} }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.createDiscount).not.toHaveBeenCalled();
  });

  it('rejects a negative factor and persists nothing', async () => {
    const repo = buildRepo();
    const service = new PricingConfigAdminService(repo as never);

    await expect(
      service.createDiscount({ code: 'NEG', name: 'x', factor: -0.5, scope: {} }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.createDiscount).not.toHaveBeenCalled();
  });

  it('rejects scope.membershipLevelNumbers given as strings (the level-number-vs-cuid trap) and persists nothing', async () => {
    const repo = buildRepo();
    const service = new PricingConfigAdminService(repo as never);

    await expect(
      service.createDiscount({
        code: 'BAD',
        name: 'x',
        factor: 0.8,
        scope: { membershipLevelNumbers: ['1'] },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.createDiscount).not.toHaveBeenCalled();
  });

  it('rejects scope.taskTypes given as non-strings and persists nothing', async () => {
    const repo = buildRepo();
    const service = new PricingConfigAdminService(repo as never);

    await expect(
      service.createDiscount({ code: 'BAD', name: 'x', factor: 0.8, scope: { taskTypes: [1, 2] } }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.createDiscount).not.toHaveBeenCalled();
  });

  it('rejects a non-object scope and persists nothing', async () => {
    const repo = buildRepo();
    const service = new PricingConfigAdminService(repo as never);

    await expect(
      service.createDiscount({ code: 'BAD', name: 'x', factor: 0.8, scope: 'not-an-object' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.createDiscount).not.toHaveBeenCalled();
  });

  it('rejects effectiveFrom >= effectiveTo when both are set, and persists nothing', async () => {
    const repo = buildRepo();
    const service = new PricingConfigAdminService(repo as never);

    await expect(
      service.createDiscount({
        code: 'BAD',
        name: 'x',
        factor: 0.8,
        scope: {},
        effectiveFrom: '2026-08-01T00:00:00.000Z',
        effectiveTo: '2026-07-01T00:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.createDiscount).not.toHaveBeenCalled();
  });

  it('translates a duplicate code (P2002) into ConflictException', async () => {
    const repo = buildRepo();
    repo.createDiscount.mockRejectedValue(p2002());
    const service = new PricingConfigAdminService(repo as never);

    await expect(
      service.createDiscount({ code: 'DUP', name: 'x', factor: 0.8, scope: {} }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('PricingConfigAdminService.updateDiscount', () => {
  it('only forwards fields present in the patch', async () => {
    const repo = buildRepo();
    repo.updateDiscount.mockResolvedValue({ id: 'd1', isActive: false });
    const service = new PricingConfigAdminService(repo as never);

    await service.updateDiscount('d1', { isActive: false });

    expect(repo.updateDiscount).toHaveBeenCalledWith('d1', { isActive: false });
  });

  it('rejects an invalid factor in the patch and persists nothing', async () => {
    const repo = buildRepo();
    const service = new PricingConfigAdminService(repo as never);

    await expect(service.updateDiscount('d1', { factor: 0 })).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.updateDiscount).not.toHaveBeenCalled();
  });

  it('translates not-found (P2025) into NotFoundException', async () => {
    const repo = buildRepo();
    repo.updateDiscount.mockRejectedValue(p2025());
    const service = new PricingConfigAdminService(repo as never);

    await expect(service.updateDiscount('missing', { isActive: false })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('PricingConfigAdminService.deleteDiscount', () => {
  it('translates not-found (P2025) into NotFoundException', async () => {
    const repo = buildRepo();
    repo.deleteDiscount.mockRejectedValue(p2025());
    const service = new PricingConfigAdminService(repo as never);

    await expect(service.deleteDiscount('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lists discounts by delegating to the repository', async () => {
    const repo = buildRepo();
    repo.listDiscounts.mockResolvedValue([{ id: 'd1' }]);
    const service = new PricingConfigAdminService(repo as never);

    await expect(service.listDiscounts()).resolves.toEqual([{ id: 'd1' }]);
  });
});
