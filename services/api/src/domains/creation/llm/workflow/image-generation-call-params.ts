import { BadRequestException, HttpStatus } from '@nestjs/common';
import { I18nHttpException } from '../../../platform/i18n/i18n-http.exception';
import {
  resolveImageOperation,
  resolveImagePreset,
  type ImageArtifact,
  type ImageCallRequest,
  type ImageOperation,
  type ImageUpstreamError,
  type ProtocolPreset,
} from '@autix/ai-adapters/image';
import { readImageModelMetadata } from '@autix/domain/model';
import { pickWireParams, type ParamsSchema } from '@autix/domain/pricing';
import { GenerationErrorStage, type Prisma } from '../../../platform/prisma/generated';
import {
  attachGenerationFailure,
  fromImageUpstreamError,
  type GenerationFailure,
} from '../../../platform/generation-tasks/generation-failure';
import { resolveApiKey, resolveBaseUrl } from '../../model-config/model-gateway-credentials';

/**
 * 「真正发出去的值」（spec §4.4）。它不再是固定 9 字段的 settings 袋 —— key 由
 * preset 的绑定决定，由 `ImageCallResult.applied.params` 回填。此前这里记的是
 * 「我们打算发的值」，与实际请求体可能不一致（DB 记录的参数 ≠ 实际发出的参数）。
 */
export interface AppliedImageSettings {
  count: number;
  coerced: boolean;
  notes: string[];
  [key: string]: unknown;
}

export interface CallImageApiResult {
  images: string[];
  appliedSettings: AppliedImageSettings;
  /**
   * The `sourceImages`/`referenceImages` actually dispatched upstream — after
   * any pre-dispatch normalization (e.g. `generate-json-url` presets like
   * Seedream upload `data:` URLs to storage before sending). Callers that
   * persist the request (e.g. `generateAndPersistImage`) must reuse these
   * instead of the pre-normalize refs, so the record they store points at the
   * same URL that was actually sent upstream and the upload isn't repeated.
   */
  sourceImages?: SourceImageRef[];
  referenceImages?: SourceImageRef[];
}

export interface SourceImageRef {
  url: string;
  prompt?: string;
  generationId?: string;
  index?: number;
}

/**
 * 用户提交的参数袋。**不再是固定字段的枚举** —— 具体有哪些参数由模型的
 * paramsSchema 声明，服务端用 `pickWireParams` / `stripNonPricingParams`
 * 两个白名单投影分别筛出上游子集与计价子集。这里保留几个字段只是为了让
 * 现存调用点（entitlement 闸门读 size/quality、prompt 微调读 promptTuning）
 * 有类型可用，不代表 schema 只允许这些。
 */
export interface ImageGenerationSettings {
  size?: string;
  quality?: string;
  promptTuning?: string;
  stylePreset?: string;
  negativePrompt?: string;
  skipPromptTuning?: boolean;
  guidanceScale?: number;
  steps?: number;
  seed?: string;
  [key: string]: unknown;
}

export interface ResolvedImageRequest {
  mode: 'generate' | 'edit';
  prompt: string;
  modelConfig: {
    id: string;
    model: string;
    provider?: string | null;
    baseUrl?: string | null;
    apiKey?: string | null;
    metadata?: Prisma.JsonValue | null;
    /** 同一条 model_configs 记录里的 paramsSchema —— 投影与校验都靠它，不再另发一次查询。 */
    paramsSchema?: Prisma.JsonValue | null;
    createdBy?: string | null;
  };
  template: Record<string, unknown>;
  variables: Record<string, string>;
  sourceImages?: SourceImageRef[];
  referenceImages?: SourceImageRef[];
  settings?: ImageGenerationSettings;
}

export function asImageCallMetadata(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : undefined;
}

export function resolveImageCallCredentials(
  request: ResolvedImageRequest,
  metadata = asImageCallMetadata(request.modelConfig.metadata),
): { baseUrl: string; apiKey: string } {
  const apiKey =
    resolveApiKey({ apiKey: request.modelConfig.apiKey, metadata }) ?? '';
  const baseUrl =
    resolveBaseUrl({ baseUrl: request.modelConfig.baseUrl, metadata }) ?? '';
  return { baseUrl, apiKey };
}

/**
 * paramsSchema 是投影的白名单。它缺席时**必须拒绝**，不能当成空 schema：
 * 空 schema 会让 `pickWireParams` 丢掉每一个 wire 参数，静默按上游默认值出图
 * （用户选的尺寸/质量全部失效），而计价那边早就按用户参数收了钱。
 * 正常路径上 estimateCost 已经先于此拒绝了 paramsSchema 为 NULL 的模型。
 */
export function narrowImageParamsSchema(
  value: Prisma.JsonValue | null | undefined,
  modelConfigId: string,
): ParamsSchema {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException(`Model has no params rule (paramsSchema) configured: ${modelConfigId}`);
  }
  return value as unknown as ParamsSchema;
}

/**
 * `resolveImagePreset` 抛的是裸 `Error`（ai-adapters 是纯协议层，不认识
 * Nest 的 HttpException）。这是一条真实存在的存量数据路径 —— 任何还没被
 * `seed-pricing.ts` 回填 `metadata.protocolKey` 的 `model_configs` 行，每次
 * 生图都会走到这里。裸 `Error` 逃出 `callImageApi` 的 try/catch（它只转换
 * `ImageUpstreamError`）就是 500：一个可由运营在后台修好的配置问题，被
 * 报成了服务器故障。冻结额仍会被 `generateAndPersistImage` 的通用 catch
 * 退回，不丢分；但错误码不对，操作者拿不到可执行的信息。
 *
 * 在这里、而不是在 ai-adapters 里转换：不想给协议层引入 Nest 依赖，
 * 也不想在 `callImageApi` 里为一个「根本没进到 try」的调用单独加分支。
 * 同样绝不做静默 fallback —— 那正是老 `resolveImageAdapter` 的病根
 * （spec §2）。
 */
export function buildImageModelNotConfiguredException(
  request: ResolvedImageRequest,
  cause: unknown,
): BadRequestException {
  const modelConfigId = request.modelConfig.id;
  const model = request.modelConfig.model;
  const reason = cause instanceof Error ? cause.message : String(cause);
  // reason 覆盖 resolveImagePreset 的两种失败（protocolKey 缺失 / protocolKey 未注册），
  // 直接把它拼进 message —— 运营看到的第一行就得知道该去改哪个模型的哪个字段。
  return new BadRequestException({
    errorCode: 'ERR_IMAGE_MODEL_NOT_CONFIGURED',
    message: `Model config ${modelConfigId} (${model}) cannot be routed to an image generation protocol: ${reason}. Please configure metadata.protocolKey correctly for this model in the admin console.`,
    details: {
      modelConfigId,
      model,
      reason,
    },
  });
}

/**
 * 不再嗅探 kind、不再猜协议：`metadata.protocolKey` 显式声明，preset 决定一切
 * （spec §5）。未注册的 protocolKey 直接抛 —— 没有静默 fallback adapter。
 *
 * count 的上限在 dispatch 入口一次性 clamp（`resolveImageCountCeiling` + risk 硬上限），
 * 这里不再各自 clamp。
 */
export function buildImageCallRequest(
  request: ResolvedImageRequest,
  count: number,
  paramsSchema: ParamsSchema,
): ImageCallRequest {
  const { apiKey, baseUrl } = resolveImageCallCredentials(request);
  const metadata = readImageModelMetadata(request.modelConfig.metadata);
  let preset: ProtocolPreset;
  try {
    preset = resolveImagePreset(metadata.protocolKey);
  } catch (error) {
    throw buildImageModelNotConfiguredException(request, error);
  }

  // `resolveImageOperation` throws a bare `Error('OPERATION_NOT_ALLOWED: ...')`
  // when the routed candidate operation (generate/edit) isn't declared in
  // metadata.operations (same "ai-adapters is a pure protocol layer, doesn't
  // know Nest" reasoning as resolveImagePreset above). Left unwrapped it
  // escapes this function's caller as an unhandled 500 for a fixable config
  // problem (missing/incomplete metadata.operations) instead of a 400 the
  // operator can act on.
  let operation: ImageOperation;
  try {
    operation = resolveImageOperation(preset, metadata.operations ?? [], {
      hasSourceImages: (request.sourceImages?.length ?? 0) > 0,
      hasReferenceImages: (request.referenceImages?.length ?? 0) > 0,
    });
  } catch (error) {
    throw new BadRequestException({
      errorCode: 'ERR_IMAGE_OPERATION_NOT_ALLOWED',
      message: `Model ${request.modelConfig.model} capability config does not support the operation required by this request: ${String(error instanceof Error ? error.message : error)}`,
    });
  }

  return {
    preset,
    operation,
    baseUrl,
    apiKey,
    model: request.modelConfig.model,
    prompt: request.prompt,
    count,
    params: pickWireParams(paramsSchema, request.settings ?? {}),
    sourceImages: request.sourceImages,
    referenceImages: request.referenceImages,
  };
}

/**
 * `ai-adapters` 是纯协议层（spec §8）：artifact → data-uri / url 的转换留在 api-service。
 */
export function toImageUrlOrDataUri(artifact: ImageArtifact): string {
  return artifact.source.type === 'base64'
    ? `data:${artifact.source.mimeType};base64,${artifact.source.data}`
    : artifact.source.url;
}

/**
 * `ERR_IMAGE_PARAMS_NOT_SUPPORTED` 是前端契约的一部分（spec §7.3），保留。
 *
 * 变的是触发条件：从「正则匹配到 4xx，重试一次 safe defaults，再失败才抛」变成
 * 「preset 的 errorMapping 把这次失败分类成 `params` → 直接抛」。4xx → safe-defaults
 * 重试整条删除：它的 safe defaults 仍是同一个 `1024x1024@1K`，从未修好过任何东西，
 * 只是把上游多打了一次；preset 的 stripTierSuffix 从根上消除了那个失败模式。
 */
export function buildUnsupportedImageParamsException(
  request: ResolvedImageRequest,
  error: ImageUpstreamError,
): I18nHttpException {
  const metadata = readImageModelMetadata(request.modelConfig.metadata);
  return new I18nHttpException(
    HttpStatus.BAD_REQUEST,
    'creation.image_gen.params_not_supported',
    { model: request.modelConfig.model },
    {
      data: {
        errorCode: 'ERR_IMAGE_PARAMS_NOT_SUPPORTED',
        details: {
          model: request.modelConfig.model,
          protocolKey: metadata.protocolKey,
          httpStatus: error.httpStatus,
          upstreamError: error.message,
        },
      },
    },
  );
}

/**
 * params 类上游失败的**唯一**构造点：先建 `GenerationFailure`（结构化上游字段完整），
 * 再派生给用户看的 `BadRequestException`，最后把 failure 挂到异常上。
 *
 * 顺序是刻意的 —— `buildUnsupportedImageParamsException` 只保留 httpStatus + message，
 * 一旦先派生用户异常再想还原 upstreamBody / requestId / classification 就已经晚了。
 * 挂载而非返回二元组，是为了让 `callImageApi` 的调用方（它只看得见抛出的异常）
 * 也能把结构化失败落库。
 */
export function buildImageParamsFailure(
  request: ResolvedImageRequest,
  error: ImageUpstreamError,
): { failure: GenerationFailure; exception: BadRequestException } {
  const failure = fromImageUpstreamError(error, GenerationErrorStage.SUBMIT);
  const exception = attachGenerationFailure(
    buildUnsupportedImageParamsException(request, error),
    failure,
  );
  return { failure, exception };
}
