import type { ImageOperation, ProtocolPreset } from './types';

/**
 * 决定「协议 operation」（区别于语义 mode）。两轴路由：
 * 1. 有无输入图 × preset.referenceMode.kind → 候选 operation。
 * 2. 候选 operation 必须 ∈ metadata.operations（能力门），否则 fail fast。
 */
export function resolveImageOperation(
  preset: ProtocolPreset,
  operations: ImageOperation[],
  input: { hasSourceImages: boolean; hasReferenceImages: boolean },
): ImageOperation {
  const hasInput = input.hasSourceImages || input.hasReferenceImages;
  const candidate: ImageOperation =
    hasInput && preset.referenceMode?.kind === 'edit-multipart' ? 'edit' : 'generate';
  if (!operations.includes(candidate)) {
    throw new Error(
      `OPERATION_NOT_ALLOWED: preset "${preset.key}" needs operation "${candidate}" but metadata.operations=${JSON.stringify(operations)}`,
    );
  }
  return candidate;
}
