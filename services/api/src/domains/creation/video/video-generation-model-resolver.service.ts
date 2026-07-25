import { HttpStatus, Injectable } from '@nestjs/common';
import { I18nHttpException } from '../../platform/i18n/i18n-http.exception';
import type { Prisma } from '../../platform/prisma/generated';
import { ModelConfigService } from '../model-config/model-config.service';
import { resolveApiKey, resolveBaseUrl } from '../model-config/model-gateway-credentials';

type ClipModelParams = {
  modelConfigId?: string;
};

@Injectable()
export class VideoGenerationModelResolverService {
  constructor(private readonly modelConfigService: ModelConfigService) {}

  async resolveForGeneration(clip: {
    id: string;
    params: Prisma.JsonValue | Prisma.InputJsonValue | null;
  }, userId?: string) {
    // 无兜底：clip 必须显式携带 modelConfigId（前端选模型时写入）。缺失即拒绝，
    // 不再回退到「默认视频模型」——视频模型统一由数据库配置 + 前端显式选择。
    const modelConfigId = this.getModelConfigId(clip.params);
    if (!modelConfigId) {
      throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'creation.video.clip_model_not_selected');
    }

    const modelConfig =
      await this.modelConfigService.getConfigForOrchestrator(modelConfigId, userId);
    const apiKey = resolveApiKey(modelConfig);
    const baseUrl = resolveBaseUrl(modelConfig);
    if (!apiKey) {
      throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'creation.video.model_missing_api_key');
    }

    return {
      modelConfigId,
      modelConfig,
      apiKey,
      baseUrl,
    };
  }

  async getApiKeyForClipParams(params: Prisma.JsonValue | null) {
    return (await this.resolveApiContextForClipParams(params))?.apiKey ?? null;
  }

  async getApiKeyForClipParamsOrThrow(params: Prisma.JsonValue | null) {
    return (await this.resolveApiContextForClipParamsOrThrow(params)).apiKey;
  }

  async resolveApiContextForClipParams(params: Prisma.JsonValue | null) {
    const modelConfigId = this.getModelConfigId(params);
    if (!modelConfigId) return null;

    const modelConfig =
      await this.modelConfigService.getConfigForOrchestrator(modelConfigId);
    const apiKey = resolveApiKey(modelConfig);
    if (!apiKey) return null;

    return {
      apiKey,
      baseUrl: resolveBaseUrl(modelConfig),
      modelConfigId,
      model: modelConfig.model,
      // 受限回退（video-generation-flow.service.ts 的 resolveLegacyApiContext）需要
      // 靠 metadata.protocolKey 校验实时配置未漂移。⚠ 只读 metadata 的 protocolKey
      // （公开路由信息），凭据仍只走 resolveApiKey/resolveBaseUrl —— metadata 绝不
      // 兼作凭据来源（model-gateway-credentials.ts:56-58）。
      metadata: modelConfig.metadata,
    };
  }

  /**
   * 按提交时快照的 modelConfigId 直接解析凭证 —— 供轮询/回调/手动刷新使用，
   * 不经过 clip 的实时 params（clip params 生成后仍可改，见 resolveLegacyApiContext
   * 的文档）。返回 null（而非 throw）以便调用方在批量轮询里安静跳过。
   */
  async resolveApiContextByModelConfigId(modelConfigId: string) {
    const modelConfig =
      await this.modelConfigService.getConfigForOrchestrator(modelConfigId);
    const apiKey = resolveApiKey(modelConfig);
    if (!apiKey) return null;

    return {
      apiKey,
      baseUrl: resolveBaseUrl(modelConfig),
      modelConfigId,
      model: modelConfig.model,
    };
  }

  async resolveApiContextForClipParamsOrThrow(params: Prisma.JsonValue | null) {
    const modelConfigId = this.getModelConfigId(params);
    if (!modelConfigId) {
      throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'creation.video.clip_model_missing');
    }

    const modelConfig =
      await this.modelConfigService.getConfigForOrchestrator(modelConfigId);
    const apiKey = resolveApiKey(modelConfig);
    if (!apiKey) {
      throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'creation.video.model_missing_api_key');
    }

    return {
      apiKey,
      baseUrl: resolveBaseUrl(modelConfig),
      modelConfigId,
      model: modelConfig.model,
    };
  }

  private getModelConfigId(params: Prisma.JsonValue | Prisma.InputJsonValue | null) {
    return (params as ClipModelParams | null)?.modelConfigId;
  }
}
