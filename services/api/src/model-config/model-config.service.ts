import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ModelType, ModelVisibility } from '../prisma/generated';
import { invalidateModelCache } from '../llm/model.factory';

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
  visibility?: ModelVisibility;
  capabilities?: string[];
}

@Injectable()
export class ModelConfigService {
  constructor(private readonly prisma: PrismaService) {}

  private async isAdmin(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        isSuperAdmin: true,
        roles: { select: { role: { select: { code: true } } } },
      },
    });
    return Boolean(
      user?.isSuperAdmin ||
        user?.roles.some((ur) =>
          ['ADMIN', 'SUPER_ADMIN', 'SYSTEM_ADMIN'].includes(ur.role.code),
        ),
    );
  }

  private maskApiKey<T extends { apiKey?: string | null; createdBy?: string | null }>(
    record: T,
    userId: string,
  ): T {
    if (record.createdBy !== userId) {
      const { apiKey, ...rest } = record as any;
      return rest;
    }
    return record;
  }

  private async assertCanWrite(
    record: { visibility: ModelVisibility; createdBy: string | null },
    userId: string,
  ): Promise<void> {
    if (record.visibility === ModelVisibility.public) {
      if (!(await this.isAdmin(userId))) {
        throw new ForbiddenException('只有管理员可以修改公开模型');
      }
    } else {
      if (record.createdBy !== userId) {
        throw new NotFoundException('模型配置不存在');
      }
    }
  }

  private isVisible(
    record: { visibility: ModelVisibility; createdBy: string | null },
    userId: string,
  ): boolean {
    return record.createdBy === userId || record.visibility === ModelVisibility.public;
  }

  async findAllForUser(userId: string) {
    const records = await this.prisma.model_configs.findMany({
      where: {
        OR: [{ createdBy: userId }, { visibility: ModelVisibility.public }],
      },
      orderBy: [{ type: 'asc' }, { priority: 'desc' }],
    });
    return records.map((r) => this.maskApiKey(r, userId));
  }

  async findSystemModels() {
    return this.prisma.model_configs.findMany({
      where: { visibility: ModelVisibility.public },
      orderBy: [{ type: 'asc' }, { priority: 'desc' }],
    });
  }

  async findOneForUser(id: string, userId: string) {
    const config = await this.prisma.model_configs.findUnique({ where: { id } });
    if (!config || !this.isVisible(config, userId)) {
      throw new NotFoundException('模型配置不存在');
    }
    return this.maskApiKey(config, userId);
  }

  async findAvailableModels(userId: string) {
    const [privateModels, publicModels] = await Promise.all([
      this.prisma.model_configs.findMany({
        where: { isActive: true, createdBy: userId },
        orderBy: [{ type: 'asc' }, { isDefault: 'desc' }, { priority: 'desc' }],
        select: {
          id: true,
          name: true,
          model: true,
          provider: true,
          type: true,
          priority: true,
          isDefault: true,
          visibility: true,
          capabilities: true,
          metadata: true,
          createdBy: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.model_configs.findMany({
        where: { isActive: true, visibility: ModelVisibility.public },
        orderBy: [{ type: 'asc' }, { isDefault: 'desc' }, { priority: 'desc' }],
        select: {
          id: true,
          name: true,
          model: true,
          provider: true,
          type: true,
          priority: true,
          isDefault: true,
          visibility: true,
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

  async findAvailableGeneralModels(userId: string) {
    return this.findAvailableModels(userId);
  }

  async findDefaultByTypeForUser(type: ModelType, userId: string) {
    const privateDefault = await this.prisma.model_configs.findFirst({
      where: { type, isActive: true, isDefault: true, createdBy: userId },
    });
    if (privateDefault) return this.maskApiKey(privateDefault, userId);

    const publicDefault = await this.prisma.model_configs.findFirst({
      where: { type, isActive: true, isDefault: true, visibility: ModelVisibility.public },
    });
    if (publicDefault) return this.maskApiKey(publicDefault, userId);

    return null;
  }

  /**
   * 内部使用：获取某类型的默认模型（不区分用户），供 orchestrator / llm 等服务调用。
   */
  async findDefaultByType(type: ModelType) {
    return this.prisma.model_configs.findFirst({
      where: { type, isActive: true, isDefault: true },
    });
  }

  /**
   * 供 Orchestrator 内部使用，返回完整记录（含 apiKey），不通过 HTTP 暴露。
   */
  async getConfigForOrchestrator(id: string) {
    const config = await this.prisma.model_configs.findUnique({ where: { id } });
    if (!config) {
      throw new NotFoundException(`模型配置不存在: ${id}`);
    }
    return config;
  }

  async create(dto: CreateModelConfigDto, userId: string) {
    const visibility = dto.visibility ?? ModelVisibility.private;

    if (visibility === ModelVisibility.public) {
      if (!(await this.isAdmin(userId))) {
        throw new ForbiddenException('只有管理员可以创建公开模型');
      }
    }

    if (dto.isDefault) {
      if (visibility === ModelVisibility.public) {
        await this.prisma.model_configs.updateMany({
          where: {
            type: dto.type ?? ModelType.general,
            visibility: ModelVisibility.public,
            isDefault: true,
          },
          data: { isDefault: false },
        });
      } else {
        await this.prisma.model_configs.updateMany({
          where: {
            type: dto.type ?? ModelType.general,
            createdBy: userId,
            isDefault: true,
          },
          data: { isDefault: false },
        });
      }
    }

    return this.prisma.model_configs.create({
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
        visibility,
        createdBy: userId,
        capabilities: dto.capabilities ?? ['text'],
      },
    });
  }

  async update(id: string, dto: UpdateModelConfigDto, userId: string) {
    const existing = await this.prisma.model_configs.findUnique({ where: { id } });
    if (!existing || !this.isVisible(existing, userId)) {
      throw new NotFoundException('模型配置不存在');
    }
    await this.assertCanWrite(existing, userId);

    if (dto.visibility !== undefined && dto.visibility !== existing.visibility) {
      if (dto.visibility === ModelVisibility.public) {
        if (!(await this.isAdmin(userId))) {
          throw new ForbiddenException('只有管理员可以将模型设为公开');
        }
      }
    }

    if (dto.isDefault) {
      const effectiveVisibility = dto.visibility ?? existing.visibility;
      const effectiveType = dto.type ?? existing.type;
      if (effectiveVisibility === ModelVisibility.public) {
        await this.prisma.model_configs.updateMany({
          where: {
            type: effectiveType,
            visibility: ModelVisibility.public,
            isDefault: true,
            id: { not: id },
          },
          data: { isDefault: false },
        });
      } else {
        await this.prisma.model_configs.updateMany({
          where: {
            type: effectiveType,
            createdBy: userId,
            isDefault: true,
            id: { not: id },
          },
          data: { isDefault: false },
        });
      }
    }

    invalidateModelCache(id);

    const { visibility: _vis, ...safeDto } = dto as any;
    const data: any = {};
    for (const [key, value] of Object.entries(safeDto)) {
      if (value !== undefined) data[key] = value;
    }
    if (dto.visibility !== undefined) {
      data.visibility = dto.visibility;
    }
    if (dto.metadata !== undefined) {
      data.metadata = dto.metadata as any;
    }

    return this.prisma.model_configs.update({ where: { id }, data });
  }

  async deleteForUser(id: string, userId: string) {
    const existing = await this.prisma.model_configs.findUnique({ where: { id } });
    if (!existing || !this.isVisible(existing, userId)) {
      throw new NotFoundException('模型配置不存在');
    }
    await this.assertCanWrite(existing, userId);
    invalidateModelCache(id);
    return this.prisma.model_configs.delete({ where: { id } });
  }

  // kept for internal/orchestrator usage
  async findById(id: string) {
    const config = await this.prisma.model_configs.findUnique({ where: { id } });
    if (!config) throw new NotFoundException(`模型配置不存在: ${id}`);
    return config;
  }
}
