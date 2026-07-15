import { PricingConfigAdminController } from './pricing-config-admin.controller';

describe('PricingConfigAdminController', () => {
  it('getModel delegates to the service by id', async () => {
    const service = { getModel: vi.fn().mockResolvedValue({ id: 'm1' }) };
    const controller = new PricingConfigAdminController(service as never);

    await expect(controller.getModel('m1')).resolves.toEqual({ id: 'm1' });
    expect(service.getModel).toHaveBeenCalledWith('m1');
  });

  it('updateSchemas forwards id and body to the service', async () => {
    const service = { updateModelSchemas: vi.fn().mockResolvedValue({ id: 'm1', schemaVersion: 2 }) };
    const controller = new PricingConfigAdminController(service as never);
    const body = { paramsSchema: { type: 'object', properties: {} }, pricingSchema: { terms: [] } };

    await controller.updateSchemas('m1', body as never);

    expect(service.updateModelSchemas).toHaveBeenCalledWith('m1', body);
  });

  it('updateDescription forwards id and the description map to the service', async () => {
    const service = { updateModelDescription: vi.fn().mockResolvedValue({ id: 'm1' }) };
    const controller = new PricingConfigAdminController(service as never);

    await controller.updateDescription('m1', { description: { 'zh-CN': 'x' } } as never);

    expect(service.updateModelDescription).toHaveBeenCalledWith('m1', { 'zh-CN': 'x' });
  });

  it('dryRun forwards the body to the service and never touches persistence itself', async () => {
    const service = { dryRun: vi.fn().mockReturnValue({ total: 10, breakdown: [] }) };
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

describe('PricingConfigAdminController task_definitions routes', () => {
  it('listTaskDefinitions delegates to the service', async () => {
    const service = { listTaskDefinitions: vi.fn().mockResolvedValue([{ taskType: 't' }]) };
    const controller = new PricingConfigAdminController(service as never);

    await expect(controller.listTaskDefinitions()).resolves.toEqual([{ taskType: 't' }]);
    expect(service.listTaskDefinitions).toHaveBeenCalledWith();
  });

  it('createTaskDefinition forwards the body to the service', async () => {
    const service = { createTaskDefinition: vi.fn().mockResolvedValue({ taskType: 't' }) };
    const controller = new PricingConfigAdminController(service as never);
    const body = { taskType: 't', name: 'T', category: 'chat', fixedCostSchema: null };

    await controller.createTaskDefinition(body as never);

    expect(service.createTaskDefinition).toHaveBeenCalledWith(body);
  });

  it('updateTaskDefinition forwards taskType and body to the service', async () => {
    const service = { updateTaskDefinition: vi.fn().mockResolvedValue({ taskType: 't' }) };
    const controller = new PricingConfigAdminController(service as never);
    const body = { isActive: false };

    await controller.updateTaskDefinition('t', body as never);

    expect(service.updateTaskDefinition).toHaveBeenCalledWith('t', body);
  });

  it('deleteTaskDefinition forwards taskType to the service', async () => {
    const service = { deleteTaskDefinition: vi.fn().mockResolvedValue({ taskType: 't', isActive: false }) };
    const controller = new PricingConfigAdminController(service as never);

    await controller.deleteTaskDefinition('t');

    expect(service.deleteTaskDefinition).toHaveBeenCalledWith('t');
  });
});

describe('PricingConfigAdminController task_model_bindings routes', () => {
  it('listTaskModelBindings forwards the optional taskType query param', async () => {
    const service = { listTaskModelBindings: vi.fn().mockResolvedValue([]) };
    const controller = new PricingConfigAdminController(service as never);

    await controller.listTaskModelBindings('image_generation');

    expect(service.listTaskModelBindings).toHaveBeenCalledWith('image_generation');
  });

  it('createTaskModelBinding forwards the body to the service', async () => {
    const service = { createTaskModelBinding: vi.fn().mockResolvedValue({}) };
    const controller = new PricingConfigAdminController(service as never);
    const body = { taskType: 't', modelConfigId: 'm1', multiplier: 1, isDefault: true };

    await controller.createTaskModelBinding(body as never);

    expect(service.createTaskModelBinding).toHaveBeenCalledWith(body);
  });

  it('updateTaskModelBinding forwards taskType, modelConfigId, and body to the service', async () => {
    const service = { updateTaskModelBinding: vi.fn().mockResolvedValue({}) };
    const controller = new PricingConfigAdminController(service as never);
    const body = { multiplier: 2 };

    await controller.updateTaskModelBinding('t', 'm1', body as never);

    expect(service.updateTaskModelBinding).toHaveBeenCalledWith('t', 'm1', body);
  });

  it('deleteTaskModelBinding forwards taskType and modelConfigId to the service', async () => {
    const service = { deleteTaskModelBinding: vi.fn().mockResolvedValue({}) };
    const controller = new PricingConfigAdminController(service as never);

    await controller.deleteTaskModelBinding('t', 'm1');

    expect(service.deleteTaskModelBinding).toHaveBeenCalledWith('t', 'm1');
  });
});

describe('PricingConfigAdminController discounts routes', () => {
  it('listDiscounts delegates to the service', async () => {
    const service = { listDiscounts: vi.fn().mockResolvedValue([]) };
    const controller = new PricingConfigAdminController(service as never);

    await controller.listDiscounts();

    expect(service.listDiscounts).toHaveBeenCalledWith();
  });

  it('createDiscount forwards the body to the service', async () => {
    const service = { createDiscount: vi.fn().mockResolvedValue({ id: 'd1' }) };
    const controller = new PricingConfigAdminController(service as never);
    const body = { code: 'SUMMER', name: 'x', factor: 0.8, scope: {} };

    await controller.createDiscount(body as never);

    expect(service.createDiscount).toHaveBeenCalledWith(body);
  });

  it('updateDiscount forwards id and body to the service', async () => {
    const service = { updateDiscount: vi.fn().mockResolvedValue({ id: 'd1' }) };
    const controller = new PricingConfigAdminController(service as never);
    const body = { isActive: false };

    await controller.updateDiscount('d1', body as never);

    expect(service.updateDiscount).toHaveBeenCalledWith('d1', body);
  });

  it('deleteDiscount forwards id to the service', async () => {
    const service = { deleteDiscount: vi.fn().mockResolvedValue({}) };
    const controller = new PricingConfigAdminController(service as never);

    await controller.deleteDiscount('d1');

    expect(service.deleteDiscount).toHaveBeenCalledWith('d1');
  });
});
