import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ModelType, ModelVisibility } from '@prisma/client';

export interface CreateModelConfigDto {
  name: string;
  provider?: string;
  model: string;
  type?: ModelType;
  priority?: number;
  baseUrl?: string;
  apiKey?: string;
  metadata?: Record<string, unknown>;
  isActive?: boolean;
  isDefault?: boolean;
  visibility?: ModelVisibility;
  // capabilities：模型的感知能力标签数组，支持多标签。
  // 推荐值：text | vision | voice | speech | code | reasoning | image | embedding
  capabilities?: string[];
}

export interface UpdateModelConfigDto {
  name?: string;
  provider?: string;
  model?: string;
  type?: ModelType;
  priority?: number;
  baseUrl?: string;
  apiKey?: string;
  metadata?: Record<string, unknown>;
  isActive?: boolean;
  isDefault?: boolean;
  // capabilities：模型的感知能力标签数组
  capabilities?: string[];
}

@Injectable()
export class ModelConfigService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 根据 ID 获取单个模型配置
   */
  async findById(id: string) {
    const config = await this.prisma.modelConfig.findUnique({ where: { id } });
    if (!config) throw new NotFoundException(`模型配置不存在: ${id}`);
    return config;
  }

  /**
   * 获取指定类型的所有激活模型（私人优先 → 公开，每组按 priority 降序）。
   */
  async findByType(type: ModelType, userId?: string) {
    const privateModels = await this.prisma.modelConfig.findMany({
      where: { type, isActive: true, createdBy: userId },
      orderBy: { priority: 'desc' },
    });
    const publicModels = await this.prisma.modelConfig.findMany({
      where: { type, isActive: true, visibility: ModelVisibility.public },
      orderBy: { priority: 'desc' },
    });
    return [...privateModels, ...publicModels];
  }

  /**
   * 获取某类型的默认模型（私人优先，再公开）。
   * 用于未传 modelId 时的兜底选择。
   */
  async findDefaultByType(type: ModelType) {
    return this.prisma.modelConfig.findFirst({
      where: { type, isActive: true, isDefault: true },
    });
  }

  /**
   * 获取当前用户可用的 general 模型列表。
   * 私人模型（createdBy = userId）排在公开模型（visibility=public）之前，
   * 每组内部按 isDefault 降序 → priority 降序排列。
   *
   * 前端模型选择器用此接口。
   */
  async findAvailableGeneralModels(userId: string) {
    const [privateModels, publicModels] = await Promise.all([
      this.prisma.modelConfig.findMany({
        where: { type: ModelType.general, isActive: true, createdBy: userId },
        orderBy: [{ isDefault: 'desc' }, { priority: 'desc' }],
        select: {
          id: true,
          name: true,
          model: true,
          provider: true,
          type: true,
          priority: true,
          isDefault: true,
          visibility: true,
          // capabilities：模型的感知能力标签（text/vision/voice/speech/code/reasoning/image/embedding）
          // 用于后期对接不同类型模型时过滤可用模型
          capabilities: true,
          metadata: true,
          createdBy: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.modelConfig.findMany({
        where: { type: ModelType.general, isActive: true, visibility: ModelVisibility.public },
        orderBy: [{ isDefault: 'desc' }, { priority: 'desc' }],
        select: {
          id: true,
          name: true,
          model: true,
          provider: true,
          type: true,
          priority: true,
          isDefault: true,
          visibility: true,
          // capabilities：模型的感知能力标签（text/vision/voice/speech/code/reasoning/image/embedding）
          // 用于后期对接不同类型模型时过滤可用模型
          capabilities: true,
          metadata: true,
          createdBy: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);

    return [...privateModels, ...publicModels];
  }

  /**
   * 获取某类型的默认模型（私人优先，再公开）。
   * 用于未传 modelId 时的兜底选择。
   */
  async findDefaultByTypeForUser(type: ModelType, userId: string) {
    const privateDefault = await this.prisma.modelConfig.findFirst({
      where: { type, isActive: true, isDefault: true, createdBy: userId },
    });
    if (privateDefault) return privateDefault;

    return this.prisma.modelConfig.findFirst({
      where: { type, isActive: true, isDefault: true, visibility: ModelVisibility.public },
    });
  }

  /**
   * 获取单个模型配置（供 Orchestrator 使用，不抛异常）。
   */
  async getConfigForOrchestrator(id: string) {
    const config = await this.prisma.modelConfig.findUnique({ where: { id } });
    if (!config) {
      throw new NotFoundException(`模型配置不存在: ${id}`);
    }
    return config;
  }

  /**
   * 创建模型配置
   */
  async create(dto: CreateModelConfigDto, createdBy?: string) {
    if (dto.isDefault) {
      await this.prisma.modelConfig.updateMany({
        where: { type: dto.type ?? ModelType.general, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.modelConfig.create({
      data: {
        name: dto.name,
        provider: dto.provider ?? 'openai',
        model: dto.model,
        type: dto.type ?? ModelType.general,
        priority: dto.priority ?? 0,
        baseUrl: dto.baseUrl,
        apiKey: dto.apiKey,
        metadata: dto.metadata as any,
        isActive: dto.isActive ?? true,
        isDefault: dto.isDefault ?? false,
        visibility: dto.visibility ?? ModelVisibility.public,
        createdBy,
        // capabilities：模型的感知能力标签，默认为 ["text"]
        capabilities: dto.capabilities ?? ['text'],
      },
    });
  }

  /**
   * 更新模型配置
   */
  async update(id: string, dto: UpdateModelConfigDto) {
    await this.findById(id);

    if (dto.isDefault) {
      const config = await this.findById(id);
      await this.prisma.modelConfig.updateMany({
        where: { type: config.type, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    return this.prisma.modelConfig.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.provider !== undefined && { provider: dto.provider }),
        ...(dto.model !== undefined && { model: dto.model }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.priority !== undefined && { priority: dto.priority }),
        ...(dto.baseUrl !== undefined && { baseUrl: dto.baseUrl }),
        ...(dto.apiKey !== undefined && { apiKey: dto.apiKey }),
        ...(dto.metadata !== undefined && { metadata: dto.metadata as any }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }),
        ...(dto.capabilities !== undefined && { capabilities: dto.capabilities }),
      },
    });
  }

  /**
   * 删除模型配置
   */
  async delete(id: string) {
    await this.findById(id);
    return this.prisma.modelConfig.delete({ where: { id } });
  }

  /**
   * 获取所有模型配置（管理后台用）
   */
  async findAll() {
    return this.prisma.modelConfig.findMany({
      orderBy: [{ type: 'asc' }, { priority: 'desc' }],
    });
  }
}
