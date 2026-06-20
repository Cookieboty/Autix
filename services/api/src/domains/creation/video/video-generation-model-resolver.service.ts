import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ModelType, type Prisma } from '../../platform/prisma/generated';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { ModelConfigService } from '../model-config/model-config.service';

type ClipModelParams = {
  modelConfigId?: string;
};

@Injectable()
export class VideoGenerationModelResolverService {
  private readonly logger = new Logger(VideoGenerationModelResolverService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly modelConfigService: ModelConfigService,
  ) {}

  async probeDefaultVideoModel() {
    // 启动期只读探测默认视频模型，缺失时 WARN（不阻断启动，避免开发态被卡）。
    try {
      const def = await this.modelConfigService.findDefaultByType(
        ModelType.video,
      );
      if (!def) {
        this.logger.warn(
          '未发现默认视频模型 (type=video, isDefault=true)。',
        );
        this.logger.warn(
          '视频生成路径将依赖 clip.params.modelConfigId 显式指定；若也缺失则 generate 时抛 BadRequestException。',
        );
      } else {
        this.logger.log(
          `默认视频模型: ${def.name} (id=${def.id}, model=${def.model})`,
        );
      }
    } catch (err) {
      this.logger.warn(`默认视频模型探测失败: ${(err as Error).message}`);
    }
  }

  async resolveForGeneration(clip: {
    id: string;
    params: Prisma.JsonValue | null;
  }) {
    let modelConfigId = this.getModelConfigId(clip.params);
    if (!modelConfigId) {
      const def = await this.modelConfigService.findDefaultByType(
        ModelType.video,
      );
      if (!def) {
        throw new BadRequestException(
          '未配置默认视频模型，请先在管理后台配置（type=video, isDefault=true）',
        );
      }

      modelConfigId = def.id;
      await this.prisma.video_clips.update({
        where: { id: clip.id },
        data: {
          params: {
            ...this.toParamRecord(clip.params),
            modelConfigId,
          } as Prisma.InputJsonValue,
        },
      });
      this.logger.log(
        `Clip ${clip.id} fallback to default video model ${modelConfigId}`,
      );
    }

    const modelConfig =
      await this.modelConfigService.getConfigForOrchestrator(modelConfigId);
    if (!modelConfig.apiKey) {
      throw new BadRequestException('视频模型缺少 API Key 配置');
    }

    return {
      modelConfigId,
      modelConfig,
      apiKey: modelConfig.apiKey,
    };
  }

  async getApiKeyForClipParams(params: Prisma.JsonValue | null) {
    const modelConfigId = this.getModelConfigId(params);
    if (!modelConfigId) return null;

    const modelConfig =
      await this.modelConfigService.getConfigForOrchestrator(modelConfigId);
    return modelConfig.apiKey ?? null;
  }

  async getApiKeyForClipParamsOrThrow(params: Prisma.JsonValue | null) {
    const modelConfigId = this.getModelConfigId(params);
    if (!modelConfigId) {
      throw new BadRequestException('Clip 未配置模型，无法刷新');
    }

    const modelConfig =
      await this.modelConfigService.getConfigForOrchestrator(modelConfigId);
    if (!modelConfig.apiKey) {
      throw new BadRequestException('视频模型缺少 API Key 配置');
    }

    return modelConfig.apiKey;
  }

  private getModelConfigId(params: Prisma.JsonValue | null) {
    return (params as ClipModelParams | null)?.modelConfigId;
  }

  private toParamRecord(params: Prisma.JsonValue | null) {
    if (!params || typeof params !== 'object' || Array.isArray(params)) {
      return {};
    }
    return params as Record<string, unknown>;
  }
}
