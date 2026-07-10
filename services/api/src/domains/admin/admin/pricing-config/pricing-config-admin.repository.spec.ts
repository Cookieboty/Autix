import { PricingConfigAdminRepository } from './pricing-config-admin.repository';
import { Prisma } from '../../../platform/prisma/generated';

describe('PricingConfigAdminRepository task_definitions CRUD', () => {
  it('listTaskDefinitions orders by sort ascending', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const repo = new PricingConfigAdminRepository({ task_definitions: { findMany } } as never);

    await repo.listTaskDefinitions();

    expect(findMany).toHaveBeenCalledWith({ orderBy: { sort: 'asc' } });
  });

  it('createTaskDefinition writes the given fields', async () => {
    const create = jest.fn().mockResolvedValue({ taskType: 'new_task' });
    const repo = new PricingConfigAdminRepository({ task_definitions: { create } } as never);

    await repo.createTaskDefinition({
      taskType: 'new_task',
      name: 'New Task',
      category: 'chat',
      fixedCostSchema: null,
    });

    expect(create).toHaveBeenCalledWith({
      data: { taskType: 'new_task', name: 'New Task', category: 'chat', fixedCostSchema: Prisma.JsonNull },
    });
  });

  it('updateTaskDefinition patches only the given fields', async () => {
    const update = jest.fn().mockResolvedValue({ taskType: 'new_task', isActive: false });
    const repo = new PricingConfigAdminRepository({ task_definitions: { update } } as never);

    await repo.updateTaskDefinition('new_task', { isActive: false });

    expect(update).toHaveBeenCalledWith({ where: { taskType: 'new_task' }, data: { isActive: false } });
  });

  it('updateTaskDefinition converts a null fixedCostSchema in the patch to Prisma.JsonNull', async () => {
    const update = jest.fn().mockResolvedValue({ taskType: 'new_task', fixedCostSchema: null });
    const repo = new PricingConfigAdminRepository({ task_definitions: { update } } as never);

    await repo.updateTaskDefinition('new_task', { fixedCostSchema: null });

    expect(update).toHaveBeenCalledWith({
      where: { taskType: 'new_task' },
      data: { fixedCostSchema: Prisma.JsonNull },
    });
  });

  it('deactivateTaskDefinition soft-deletes by flipping isActive to false, never a hard delete', async () => {
    const update = jest.fn().mockResolvedValue({ taskType: 'new_task', isActive: false });
    const deleteFn = jest.fn();
    const repo = new PricingConfigAdminRepository({ task_definitions: { update, delete: deleteFn } } as never);

    await repo.deactivateTaskDefinition('new_task');

    expect(update).toHaveBeenCalledWith({ where: { taskType: 'new_task' }, data: { isActive: false } });
    expect(deleteFn).not.toHaveBeenCalled();
  });
});

describe('PricingConfigAdminRepository.createTaskModelBinding', () => {
  it('creates a non-default binding directly, without a transaction', async () => {
    const create = jest.fn().mockResolvedValue({ taskType: 't', modelConfigId: 'm1' });
    const $transaction = jest.fn();
    const repo = new PricingConfigAdminRepository({
      task_model_bindings: { create },
      $transaction,
    } as never);

    await repo.createTaskModelBinding({
      taskType: 't',
      modelConfigId: 'm1',
      multiplier: 1,
      isDefault: false,
    });

    expect(create).toHaveBeenCalledWith({
      data: { taskType: 't', modelConfigId: 'm1', multiplier: 1, isDefault: false },
    });
    expect($transaction).not.toHaveBeenCalled();
  });

  it('clears the previous default binding for the task inside a transaction when creating a new default', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const create = jest.fn().mockResolvedValue({ taskType: 't', modelConfigId: 'm2', isDefault: true });
    const tx = { task_model_bindings: { updateMany, create } };
    const $transaction = jest.fn((cb: (tx: unknown) => unknown) => cb(tx));
    const repo = new PricingConfigAdminRepository({
      task_model_bindings: {},
      $transaction,
    } as never);

    await repo.createTaskModelBinding({
      taskType: 't',
      modelConfigId: 'm2',
      multiplier: 1,
      isDefault: true,
    });

    expect($transaction).toHaveBeenCalledTimes(1);
    expect(updateMany).toHaveBeenCalledWith({
      where: { taskType: 't', isDefault: true },
      data: { isDefault: false },
    });
    expect(create).toHaveBeenCalledWith({
      data: { taskType: 't', modelConfigId: 'm2', multiplier: 1, isDefault: true },
    });
  });

  it('rethrows Prisma P2002 as-is for the service layer to translate', async () => {
    const prismaError = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
    const create = jest.fn().mockRejectedValue(prismaError);
    const repo = new PricingConfigAdminRepository({ task_model_bindings: { create } } as never);

    await expect(
      repo.createTaskModelBinding({
        taskType: 'image_generation',
        modelConfigId: 'model-2',
        multiplier: 1,
        isDefault: false,
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });
});

describe('PricingConfigAdminRepository.updateTaskModelBinding', () => {
  it('updates a binding directly when isDefault is not being set to true', async () => {
    const update = jest.fn().mockResolvedValue({ taskType: 't', modelConfigId: 'm1', multiplier: 2 });
    const $transaction = jest.fn();
    const repo = new PricingConfigAdminRepository({
      task_model_bindings: { update },
      $transaction,
    } as never);

    await repo.updateTaskModelBinding('t', 'm1', { multiplier: 2 });

    expect(update).toHaveBeenCalledWith({
      where: { taskType_modelConfigId: { taskType: 't', modelConfigId: 'm1' } },
      data: { multiplier: 2 },
    });
    expect($transaction).not.toHaveBeenCalled();
  });

  it('clears the previous default binding in a transaction when setting isDefault: true', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const update = jest.fn().mockResolvedValue({ taskType: 't', modelConfigId: 'm2', isDefault: true });
    const tx = { task_model_bindings: { updateMany, update } };
    const $transaction = jest.fn((cb: (tx: unknown) => unknown) => cb(tx));
    const repo = new PricingConfigAdminRepository({
      task_model_bindings: {},
      $transaction,
    } as never);

    await repo.updateTaskModelBinding('t', 'm2', { isDefault: true });

    expect($transaction).toHaveBeenCalledTimes(1);
    expect(updateMany).toHaveBeenCalledWith({
      where: { taskType: 't', isDefault: true },
      data: { isDefault: false },
    });
    expect(update).toHaveBeenCalledWith({
      where: { taskType_modelConfigId: { taskType: 't', modelConfigId: 'm2' } },
      data: { isDefault: true },
    });
  });
});

describe('PricingConfigAdminRepository.deleteTaskModelBinding', () => {
  it('deletes by composite key', async () => {
    const deleteFn = jest.fn();
    const repo = new PricingConfigAdminRepository({ task_model_bindings: { delete: deleteFn } } as never);

    await repo.deleteTaskModelBinding('t', 'm1');

    expect(deleteFn).toHaveBeenCalledWith({ where: { taskType_modelConfigId: { taskType: 't', modelConfigId: 'm1' } } });
  });
});

describe('PricingConfigAdminRepository discounts CRUD', () => {
  it('listDiscounts orders by priority descending', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const repo = new PricingConfigAdminRepository({ pricing_discounts: { findMany } } as never);

    await repo.listDiscounts();

    expect(findMany).toHaveBeenCalledWith({ orderBy: { priority: 'desc' } });
  });

  it('createDiscount writes factor and scope as given', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'd1' });
    const repo = new PricingConfigAdminRepository({ pricing_discounts: { create } } as never);

    await repo.createDiscount({
      code: 'SUMMER',
      name: '夏季活动',
      factor: 0.8,
      scope: { taskTypes: ['image_generation'] },
      stackable: false,
      priority: 0,
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        code: 'SUMMER',
        name: '夏季活动',
        factor: 0.8,
        scope: { taskTypes: ['image_generation'] },
        stackable: false,
        priority: 0,
      },
    });
  });

  it('updateDiscount patches only the given fields', async () => {
    const update = jest.fn().mockResolvedValue({ id: 'd1', isActive: false });
    const repo = new PricingConfigAdminRepository({ pricing_discounts: { update } } as never);

    await repo.updateDiscount('d1', { isActive: false });

    expect(update).toHaveBeenCalledWith({ where: { id: 'd1' }, data: { isActive: false } });
  });

  it('deleteDiscount removes by id', async () => {
    const deleteFn = jest.fn();
    const repo = new PricingConfigAdminRepository({ pricing_discounts: { delete: deleteFn } } as never);

    await repo.deleteDiscount('d1');

    expect(deleteFn).toHaveBeenCalledWith({ where: { id: 'd1' } });
  });
});
