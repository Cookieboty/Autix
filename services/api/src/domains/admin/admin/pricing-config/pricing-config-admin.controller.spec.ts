import { PricingConfigAdminController } from './pricing-config-admin.controller';

describe('PricingConfigAdminController', () => {
  it('getModel delegates to the service by id', async () => {
    const service = { getModel: jest.fn().mockResolvedValue({ id: 'm1' }) };
    const controller = new PricingConfigAdminController(service as never);

    await expect(controller.getModel('m1')).resolves.toEqual({ id: 'm1' });
    expect(service.getModel).toHaveBeenCalledWith('m1');
  });

  it('updateSchemas forwards id and body to the service', async () => {
    const service = { updateModelSchemas: jest.fn().mockResolvedValue({ id: 'm1', schemaVersion: 2 }) };
    const controller = new PricingConfigAdminController(service as never);
    const body = { paramsSchema: { type: 'object', properties: {} }, pricingSchema: { terms: [] } };

    await controller.updateSchemas('m1', body as never);

    expect(service.updateModelSchemas).toHaveBeenCalledWith('m1', body);
  });

  it('updateDescription forwards id and the description map to the service', async () => {
    const service = { updateModelDescription: jest.fn().mockResolvedValue({ id: 'm1' }) };
    const controller = new PricingConfigAdminController(service as never);

    await controller.updateDescription('m1', { description: { 'zh-CN': 'x' } } as never);

    expect(service.updateModelDescription).toHaveBeenCalledWith('m1', { 'zh-CN': 'x' });
  });

  it('dryRun forwards the body to the service and never touches persistence itself', async () => {
    const service = { dryRun: jest.fn().mockReturnValue({ total: 10, breakdown: [] }) };
    const controller = new PricingConfigAdminController(service as never);
    const body = {
      paramsSchema: { type: 'object', properties: {} },
      pricingSchema: { terms: [{ id: 'base', op: 'add', const: 10 }] },
      sampleParams: {},
    };

    const result = await controller.dryRun(body as never);

    expect(result).toEqual({ total: 10, breakdown: [] });
    expect(service.dryRun).toHaveBeenCalledWith(body);
  });
});
