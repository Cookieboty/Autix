import { AdminService } from './admin.service';
import { AdminAuditStore } from './admin-audit.store';
import { buildPricingWorkbookBuffer } from './pricing-excel/pricing-excel';
import type { AuthUser } from '@autix/domain';
import type { PricingRuleRow } from '@autix/domain/billing';

function imageRow(): PricingRuleRow {
  return {
    taskType: 'image_generation',
    name: 'Seedream · 1080p',
    baseUnit: 'image',
    priority: 10,
    isActive: true,
    modelKeys: ['["seedance","seedream-4"]'],
    modelTiers: [],
    qualities: ['hd'],
    resolutions: [],
    membershipLevels: [],
    requireVideoInput: false,
    requireAudioInput: false,
    requirePriority: false,
    minDurationSeconds: null,
    maxDurationSeconds: null,
    extraConditions: null,
    baseCost: 90,
    fixedExtraCost: null,
    inputTokenCostPerK: null,
    outputTokenCostPerK: null,
    contextTokenCostPerK: null,
    toolCallCost: null,
    mcpCallCost: null,
    skillCallCost: null,
    batchUnitCost: null,
    referenceImageFixedCost: 5,
    reasoningMultiplier: null,
    referenceImageMultiplier: 1.5,
    videoInputMultiplier: null,
    audioInputMultiplier: null,
    priorityMultiplier: null,
  };
}

function buildService(existingRules: Array<Record<string, unknown>> = []) {
  const adminRepository = {
    getPricingRulesForTask: jest.fn().mockResolvedValue(existingRules),
    upsertPricingRulesInTransaction: jest
      .fn()
      .mockResolvedValue({ created: 1, updated: 0 }),
  } as any;

  const service = new AdminService(
    adminRepository,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    new AdminAuditStore(),
    {} as any,
  );
  return { adminRepository, service };
}

const adminUser: AuthUser = {
  id: 'admin-1',
  username: 'admin',
  email: 'admin@example.com',
  isSuperAdmin: true,
  status: 'ACTIVE',
  permissions: [],
  roles: [],
};

describe('AdminService.importPricingRulesXlsx', () => {
  it('rejects an unknown taskType before reading the file', async () => {
    const { service } = buildService();
    await expect(
      service.importPricingRulesXlsx(adminUser, Buffer.from(''), 'not_a_task', false),
    ).rejects.toThrow();
  });

  it('dry run reports counts without writing', async () => {
    const { adminRepository, service } = buildService();
    const buffer = await buildPricingWorkbookBuffer([imageRow()], 'image_generation');

    const result = await service.importPricingRulesXlsx(
      adminUser,
      buffer,
      'image_generation',
      true,
    );

    expect(result.dryRun).toBe(true);
    expect(result.created).toBe(1);
    expect(result.updated).toBe(0);
    expect(result.errors).toEqual([]);
    expect(adminRepository.upsertPricingRulesInTransaction).not.toHaveBeenCalled();
  });

  it('real import writes exactly the parsed rows in one transaction', async () => {
    const { adminRepository, service } = buildService();
    const buffer = await buildPricingWorkbookBuffer([imageRow()], 'image_generation');

    const result = await service.importPricingRulesXlsx(
      adminUser,
      buffer,
      'image_generation',
      false,
    );

    expect(result.dryRun).toBe(false);
    expect(adminRepository.upsertPricingRulesInTransaction).toHaveBeenCalledTimes(1);
    const items = adminRepository.upsertPricingRulesInTransaction.mock.calls[0][0];
    expect(items).toHaveLength(1);
    expect(items[0].id).toBeUndefined(); // no scope match → create
    expect(items[0].data.rule.taskType).toBe('image_generation');
    expect(items[0].data.rule.name).toBe('Seedream · 1080p');
  });

  it('overwrites the existing rule with the same scope (matched by conditions, not name)', async () => {
    // Same scope as imageRow() (model seedance/seedream-4, quality hd) but a different name.
    const existing = {
      id: 'rule_existing',
      name: '图片模板生成',
      taskType: 'image_generation',
      baseUnit: 'image',
      priority: 0,
      isActive: true,
      conditions: {
        modelKey: { in: ['["seedance","seedream-4"]'] },
        quality: { in: ['hd'] },
      },
      components: [{ componentType: 'per_image', unitCost: 1, isActive: true }],
    };
    const { adminRepository, service } = buildService([existing]);
    const buffer = await buildPricingWorkbookBuffer([imageRow()], 'image_generation');

    // Dry run classifies it as an update (service-computed counts).
    const preview = await service.importPricingRulesXlsx(adminUser, buffer, 'image_generation', true);
    expect(preview.created).toBe(0);
    expect(preview.updated).toBe(1);

    // Real import overwrites in place: same id, keeps the matched rule's name.
    await service.importPricingRulesXlsx(adminUser, buffer, 'image_generation', false);
    const items = adminRepository.upsertPricingRulesInTransaction.mock.calls[0][0];
    expect(items[0].id).toBe('rule_existing');
    expect(items[0].data.rule.name).toBe('图片模板生成');
  });

  it('rejects the whole batch when a row taskType does not match the endpoint', async () => {
    const { adminRepository, service } = buildService();
    // Workbook rows carry taskType image_generation, but we import under video_generation.
    const buffer = await buildPricingWorkbookBuffer([imageRow()], 'image_generation');

    const result = await service.importPricingRulesXlsx(
      adminUser,
      buffer,
      'video_generation',
      false,
    );

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.created).toBe(0);
    expect(result.updated).toBe(0);
    expect(adminRepository.upsertPricingRulesInTransaction).not.toHaveBeenCalled();
  });
});
