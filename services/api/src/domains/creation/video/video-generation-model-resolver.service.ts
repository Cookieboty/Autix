import { BadRequestException, Injectable } from '@nestjs/common';
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
      throw new BadRequestException('该分镜未指定视频模型，请先选择模型');
    }

    const modelConfig =
      await this.modelConfigService.getConfigForOrchestrator(modelConfigId, userId);
    const apiKey = resolveApiKey(modelConfig);
    const baseUrl = resolveBaseUrl(modelConfig);
    if (!apiKey) {
      throw new BadRequestException('视频模型缺少 API Key 配置');
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
    };
  }

  async resolveApiContextForClipParamsOrThrow(params: Prisma.JsonValue | null) {
    const modelConfigId = this.getModelConfigId(params);
    if (!modelConfigId) {
      throw new BadRequestException('Clip 未配置模型，无法刷新');
    }

    const modelConfig =
      await this.modelConfigService.getConfigForOrchestrator(modelConfigId);
    const apiKey = resolveApiKey(modelConfig);
    if (!apiKey) {
      throw new BadRequestException('视频模型缺少 API Key 配置');
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
