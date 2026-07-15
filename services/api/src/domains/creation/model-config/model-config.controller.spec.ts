import { ModelType } from '../../platform/prisma/generated';
import { ModelConfigController } from './model-config.controller';
import type { ModelConfigService } from './model-config.service';

/**
 * 这些是**边界测试**，不是纯函数测试。
 *
 * 真正的洞不是「白名单函数写错了」，而是 `findAvailableModels`（恰恰是面向登录
 * 用户的那个端点）**根本没调脱敏**，而它上下的两个方法都调了。只测 DTO 函数
 * 本身永远抓不到这类洞 —— 必须从 HTTP 边界往外看，断言「响应里没有凭据」。
 *
 * 所以这里让 service 层原样吐出带凭据的记录（就是它内部消费者需要的完整记录），
 * 再断言 controller 出去的东西是干净的。
 */
const RAW_RECORD = {
  id: 'm1',
  name: 'GPT Image 2',
  model: 'gpt-image-2',
  provider: 'gateway',
  type: 'general',
  capabilities: ['image'],
  isDefault: true,
  visibility: 'public',
  paramsSchema: { type: 'object', properties: {} },
  pricingSchema: { terms: [] },
  description: { en: 'x' },
  apiKey: 'sk-column-secret',
  baseUrl: 'https://internal-gateway.local',
  metadata: {
    modelFamily: 'gpt-image',
    protocolKey: 'openai-images',
    operations: ['generate', 'edit'],
    limits: { maxCount: 1 },
    apiKey: 'sk-metadata-secret',
    baseUrl: 'https://internal-gateway.local',
    someFutureInternalField: 'must-not-leak',
  },
};

function createController(overrides: Partial<ModelConfigService> = {}) {
  const service = {
    findAvailableGeneralModels: vi.fn(async () => [{ ...RAW_RECORD }]),
    findAvailablePublicModels: vi.fn(async () => [{ ...RAW_RECORD }]),
    findDefaultByTypeForUser: vi.fn(async () => ({ ...RAW_RECORD })),
    ...overrides,
  } as unknown as ModelConfigService;
  return new ModelConfigController(service);
}

const USER = { id: 'user-1' } as never;

function assertNoCredentials(dto: Record<string, unknown>) {
  expect(dto.apiKey).toBeUndefined();
  expect(dto.baseUrl).toBeUndefined();
  const meta = dto.metadata as Record<string, unknown>;
  expect(meta.apiKey).toBeUndefined();
  expect(meta.baseUrl).toBeUndefined();
  expect(meta.someFutureInternalField).toBeUndefined();
}

describe('ModelConfigController credential boundary', () => {
  it('GET /models/available never leaks credentials (this endpoint had NO strip at all)', async () => {
    const controller = createController();
    const [dto] = await controller.findAvailable(USER);
    assertNoCredentials(dto as Record<string, unknown>);
  });

  it('GET /models/public/available never leaks credentials', async () => {
    const controller = createController();
    const [dto] = await controller.findPublicAvailable();
    assertNoCredentials(dto as Record<string, unknown>);
  });

  it('GET /models/default/:type never leaks credentials', async () => {
    const controller = createController();
    const dto = await controller.findDefault(USER, ModelType.general);
    assertNoCredentials(dto as Record<string, unknown>);
  });

  it('GET /models/default/:type tolerates no default model', async () => {
    const controller = createController({
      findDefaultByTypeForUser: vi.fn(async () => null),
    } as never);
    expect(await controller.findDefault(USER, ModelType.general)).toBeNull();
  });

  it('still returns the fields the frontend actually needs', async () => {
    const controller = createController();
    const [dto] = await controller.findAvailable(USER);
    const meta = (dto as Record<string, unknown>).metadata as Record<string, unknown>;

    expect(dto.id).toBe('m1');
    expect(dto.name).toBe('GPT Image 2');
    expect(dto.capabilities).toEqual(['image']);
    expect(dto.paramsSchema).toEqual({ type: 'object', properties: {} });
    expect(meta.modelFamily).toBe('gpt-image');
    expect(meta.protocolKey).toBe('openai-images');
    expect(meta.operations).toEqual(['generate', 'edit']);
    expect(meta.limits).toEqual({ maxCount: 1 });
  });
});
