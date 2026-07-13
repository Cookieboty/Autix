/**
 * `model_configs.metadata` 是一个 untyped JSON 列（Prisma `Json?`），内容由后台
 * 表单写入 —— 也就是说它**是不可信输入**。这个模块是读它的唯一入口：所有读取
 * 都必须先过一遍这里拿到收窄后的类型，绝不直接 `metadata.limits.maxCount`。
 *
 * 三个维度相互独立（spec §5）：
 *   modelFamily  仅展示（分类、图标、分组）。**不参与任何行为分支。**
 *   protocolKey  路由到 preset（第 2 期才有消费者）
 *   operations   该模型支持哪些操作
 *   limits       能力上限，**不是请求参数** —— 不进 paramsSchema（spec 口径 3）
 */
import type {
  ImageModelLimits,
  ImageModelMetadata,
  ImageOperation,
} from './image-metadata.types';

export type { ImageModelLimits, ImageModelMetadata, ImageOperation };

const IMAGE_OPERATIONS: ImageOperation[] = ['generate', 'edit'];

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

function readOperations(value: unknown): ImageOperation[] | undefined {
  if (!Array.isArray(value)) return undefined;
  // 只认白名单里的操作。运营手填的 'teleport' 直接丢掉，而不是原样透出去。
  return value.filter((op): op is ImageOperation =>
    IMAGE_OPERATIONS.includes(op as ImageOperation),
  );
}

function readLimits(value: unknown): ImageModelLimits | undefined {
  const record = asRecord(value);
  if (!record) return undefined;
  const maxCount = record.maxCount;
  const valid = typeof maxCount === 'number' && Number.isInteger(maxCount) && maxCount > 0;
  return valid ? { maxCount } : {};
}

export function readImageModelMetadata(metadata: unknown): ImageModelMetadata {
  const record = asRecord(metadata);
  if (!record) return {};

  const result: ImageModelMetadata = {};
  const modelFamily = asNonEmptyString(record.modelFamily);
  if (modelFamily) result.modelFamily = modelFamily;
  const protocolKey = asNonEmptyString(record.protocolKey);
  if (protocolKey) result.protocolKey = protocolKey;
  const operations = readOperations(record.operations);
  if (operations) result.operations = operations;
  const limits = readLimits(record.limits);
  if (limits) result.limits = limits;
  return result;
}

/** ⚠ 缺省是 false：能力必须显式声明。没配 operations 的模型不该被当成什么都支持。 */
export function supportsImageOperation(metadata: unknown, op: ImageOperation): boolean {
  return readImageModelMetadata(metadata).operations?.includes(op) ?? false;
}

export function readImageMaxCount(metadata: unknown): number | undefined {
  return readImageModelMetadata(metadata).limits?.maxCount;
}
