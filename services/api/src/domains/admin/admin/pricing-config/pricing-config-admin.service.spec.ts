import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PricingConfigAdminService } from './pricing-config-admin.service';

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
    findModelConfig: jest.fn(),
    updateModelSchemas: jest.fn(),
    updateModelDescription: jest.fn(),
  };
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
