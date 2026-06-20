import { Injectable } from '@nestjs/common';
import { ModelType, ModelVisibility, Prisma } from '../../platform/prisma/generated';
import { PrismaService } from '../../platform/prisma/prisma.service';

@Injectable()
export class ModelConfigRepository {
  constructor(private readonly prisma: PrismaService) {}

  readonly modelSelectFields = {
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
  } as const;

  findPrivateModelsForUser(userId: string) {
    return this.prisma.model_configs.findMany({
      where: {
        createdBy: userId,
        visibility: ModelVisibility.private,
      },
      orderBy: [{ type: 'asc' }, { priority: 'desc' }],
    });
  }

  findSystemModels() {
    return this.prisma.model_configs.findMany({
      where: { visibility: ModelVisibility.public },
      orderBy: [{ type: 'asc' }, { priority: 'desc' }],
    });
  }

  findPrivateModelForUser(id: string, userId: string) {
    return this.prisma.model_configs.findFirst({
      where: { id, createdBy: userId, visibility: ModelVisibility.private },
    });
  }

  findAvailablePublicModels() {
    return this.prisma.model_configs.findMany({
      where: { isActive: true, visibility: ModelVisibility.public },
      orderBy: [{ type: 'asc' }, { isDefault: 'desc' }, { priority: 'desc' }],
      select: this.modelSelectFields,
    });
  }

  findAvailablePrivateModels(userId: string) {
    return this.prisma.model_configs.findMany({
      where: { isActive: true, createdBy: userId, visibility: ModelVisibility.private },
      orderBy: [{ type: 'asc' }, { isDefault: 'desc' }, { priority: 'desc' }],
      select: this.modelSelectFields,
    });
  }

  findPrivateDefaultByType(type: ModelType, userId: string) {
    return this.prisma.model_configs.findFirst({
      where: {
        type,
        isActive: true,
        isDefault: true,
        createdBy: userId,
        visibility: ModelVisibility.private,
      },
    });
  }

  findPublicDefaultByType(type: ModelType) {
    return this.prisma.model_configs.findFirst({
      where: { type, isActive: true, isDefault: true, visibility: ModelVisibility.public },
    });
  }

  findById(id: string) {
    return this.prisma.model_configs.findUnique({ where: { id } });
  }

  findPublicModel(id: string) {
    return this.prisma.model_configs.findFirst({
      where: { id, visibility: ModelVisibility.public },
    });
  }

  clearPrivateDefaults(type: ModelType, userId: string, excludedId?: string) {
    return this.prisma.model_configs.updateMany({
      where: {
        type,
        createdBy: userId,
        visibility: ModelVisibility.private,
        isDefault: true,
        ...(excludedId ? { id: { not: excludedId } } : {}),
      },
      data: { isDefault: false },
    });
  }

  clearPublicDefaults(type: ModelType, excludedId?: string) {
    return this.prisma.model_configs.updateMany({
      where: {
        type,
        visibility: ModelVisibility.public,
        isDefault: true,
        ...(excludedId ? { id: { not: excludedId } } : {}),
      },
      data: { isDefault: false },
    });
  }

  create(data: Prisma.model_configsUncheckedCreateInput) {
    return this.prisma.model_configs.create({ data });
  }

  update(id: string, data: Prisma.model_configsUncheckedUpdateInput) {
    return this.prisma.model_configs.update({ where: { id }, data });
  }

  delete(id: string) {
    return this.prisma.model_configs.delete({ where: { id } });
  }
}
