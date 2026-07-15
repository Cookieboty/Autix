import { TasksService } from './tasks.service';

function buildService(overrides: Record<string, unknown> = {}) {
  const repo = {
    findActiveTaskDefinitions: vi.fn().mockResolvedValue([{ taskType: 'image_generation', name: '图片生成' }]),
    findBindingsForTask: vi.fn().mockResolvedValue([
      {
        modelConfigId: 'model-1',
        isDefault: true,
        multiplier: { toString: () => '1.000' },
        modelConfig: {
          id: 'model-1',
          name: 'GPT Image',
          provider: 'openai',
          visibility: 'public',
          paramsSchema: { type: 'object', properties: {} },
          pricingSchema: { terms: [{ id: 'base', op: 'add', const: 90 }] },
          description: { en: 'Fast image model', 'zh-CN': '快速图片模型' },
          allowedMembershipLevels: [],
        },
      },
    ]),
    findActiveDiscounts: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
  const membershipService = {
    resolveActiveMembershipLevelId: vi.fn().mockResolvedValue(null),
    resolveActiveMembershipLevel: vi.fn().mockResolvedValue(0),
    ...(overrides.membershipService as Record<string, unknown> | undefined),
  };
  return { service: new TasksService(repo as never, membershipService as never), repo, membershipService };
}

describe('TasksService.listTasks', () => {
  it('returns active task definitions', async () => {
    const { service } = buildService();
    expect(await service.listTasks()).toEqual([{ taskType: 'image_generation', name: '图片生成' }]);
  });
});

describe('TasksService.listModelsForTask', () => {
  it('resolves description via locale and includes multiplier/discountFactor', async () => {
    const { service } = buildService();

    const result = await service.listModelsForTask('image_generation', { userId: undefined, locale: 'zh-CN' });

    expect(result).toEqual([
      {
        modelConfigId: 'model-1',
        name: 'GPT Image',
        provider: 'openai',
        isDefault: true,
        description: '快速图片模型',
        paramsSchema: { type: 'object', properties: {} },
        pricingSchema: { terms: [{ id: 'base', op: 'add', const: 90 }] },
        multiplier: 1,
        discountFactor: 1,
      },
    ]);
  });

  it('every returned model carries pricingSchema, multiplier and discountFactor (frontend priceOptions needs all three, no round trip)', async () => {
    const { service } = buildService();

    const [model] = await service.listModelsForTask('image_generation', { userId: undefined, locale: 'en' });

    expect(model).toHaveProperty('pricingSchema');
    expect(model.pricingSchema).not.toBeNull();
    expect(model).toHaveProperty('multiplier');
    expect(model).toHaveProperty('discountFactor');
  });

  it('filters out models the user cannot see', async () => {
    const { service } = buildService({
      findBindingsForTask: vi.fn().mockResolvedValue([
        {
          modelConfigId: 'model-1',
          isDefault: true,
          multiplier: { toString: () => '1.000' },
          modelConfig: {
            id: 'model-1',
            name: 'Restricted',
            provider: 'openai',
            visibility: 'public',
            paramsSchema: { type: 'object', properties: {} },
            pricingSchema: { terms: [{ id: 'base', op: 'add', const: 1 }] },
            description: {},
            allowedMembershipLevels: [{ levelId: 'lvl-pro' }],
          },
        },
      ]),
    });

    const result = await service.listModelsForTask('image_generation', { userId: undefined, locale: 'en' });

    expect(result).toEqual([]);
  });

  it('excludes a model whose pricingSchema is NULL, even when it would otherwise be visible', async () => {
    const { service } = buildService({
      findBindingsForTask: vi.fn().mockResolvedValue([
        {
          modelConfigId: 'model-unpriced',
          isDefault: false,
          multiplier: { toString: () => '1.000' },
          modelConfig: {
            id: 'model-unpriced',
            name: 'Not Configured Yet',
            provider: 'openai',
            visibility: 'public',
            paramsSchema: { type: 'object', properties: {} },
            pricingSchema: null,
            description: {},
            allowedMembershipLevels: [],
          },
        },
      ]),
    });

    const result = await service.listModelsForTask('image_generation', { userId: undefined, locale: 'en' });

    // Must be excluded outright — not shipped with pricingSchema: null, which the
    // frontend's priceOptions() has no way to render a price tag from.
    expect(result).toEqual([]);
  });

  it('falls back to en text, then the model name, when the requested locale is missing from the description map', async () => {
    const { service } = buildService({
      findBindingsForTask: vi.fn().mockResolvedValue([
        {
          modelConfigId: 'model-1',
          isDefault: true,
          multiplier: { toString: () => '1.000' },
          modelConfig: {
            id: 'model-1',
            name: 'GPT Image',
            provider: 'openai',
            visibility: 'public',
            paramsSchema: { type: 'object', properties: {} },
            pricingSchema: { terms: [{ id: 'base', op: 'add', const: 90 }] },
            description: { en: 'Fast image model' },
            allowedMembershipLevels: [],
          },
        },
      ]),
    });

    const result = await service.listModelsForTask('image_generation', { userId: undefined, locale: 'ja' });

    expect(result[0].description).toBe('Fast image model');
  });

  it('falls back to the model name when the description map has neither the requested locale nor en', async () => {
    const { service } = buildService({
      findBindingsForTask: vi.fn().mockResolvedValue([
        {
          modelConfigId: 'model-1',
          isDefault: true,
          multiplier: { toString: () => '1.000' },
          modelConfig: {
            id: 'model-1',
            name: 'GPT Image',
            provider: 'openai',
            visibility: 'public',
            paramsSchema: { type: 'object', properties: {} },
            pricingSchema: { terms: [{ id: 'base', op: 'add', const: 90 }] },
            description: {},
            allowedMembershipLevels: [],
          },
        },
      ]),
    });

    const result = await service.listModelsForTask('image_generation', { userId: undefined, locale: 'en' });

    expect(result[0].description).toBe('GPT Image');
  });

  it('resolves a lower discountFactor for a member matching an active discount than for a non-member', async () => {
    const discountRow = {
      id: 'discount-1',
      code: 'MEMBER10',
      factor: 0.9,
      scope: { membershipLevelNumbers: [2] },
      stackable: false,
      priority: 0,
      effectiveFrom: null,
      effectiveTo: null,
      isActive: true,
    };

    const nonMember = buildService({ findActiveDiscounts: vi.fn().mockResolvedValue([discountRow]) });
    const nonMemberResult = await nonMember.service.listModelsForTask('image_generation', {
      userId: undefined,
      locale: 'en',
    });
    expect(nonMemberResult[0].discountFactor).toBe(1);

    const member = buildService({ findActiveDiscounts: vi.fn().mockResolvedValue([discountRow]) });
    member.membershipService.resolveActiveMembershipLevel.mockResolvedValue(2);
    const memberResult = await member.service.listModelsForTask('image_generation', {
      userId: 'user-1',
      locale: 'en',
    });
    expect(memberResult[0].discountFactor).toBe(0.9);
  });
});
