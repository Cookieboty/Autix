import { Injectable } from '@nestjs/common';
import { ModelType, ModelVisibility, Prisma } from '../../platform/prisma/generated';
import { PrismaService } from '../../platform/prisma/prisma.service';

const membershipLevelOrderBy: Prisma.model_config_membership_levelsOrderByWithRelationInput[] = [
  { level: { sort: 'asc' } },
  { level: { level: 'asc' } },
  { level: { createdAt: 'asc' } },
];

const modelSelectFields = {
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
  allowedMembershipLevels: {
    select: {
      levelId: true,
      level: {
        select: {
          id: true,
          name: true,
          level: true,
          sort: true,
        },
      },
    },
    orderBy: membershipLevelOrderBy,
  },
} satisfies Prisma.model_configsSelect;

const modelWithMembershipInclude = {
  allowedMembershipLevels: {
    include: { level: true },
    orderBy: membershipLevelOrderBy,
  },
} satisfies Prisma.model_configsInclude;

@Injectable()
export class ModelConfigRepository {
  constructor(private readonly prisma: PrismaService) {}

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
      select: modelSelectFields,
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
      select: modelSelectFields,
    });
  }

  findAvailablePrivateModels(userId: string) {
    return this.prisma.model_configs.findMany({
      where: { isActive: true, createdBy: userId, visibility: ModelVisibility.private },
      orderBy: [{ type: 'asc' }, { isDefault: 'desc' }, { priority: 'desc' }],
      select: modelSelectFields,
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
      include: modelWithMembershipInclude,
    });
  }

  findById(id: string) {
    return this.prisma.model_configs.findUnique({
      where: { id },
      include: modelWithMembershipInclude,
    });
  }

  findPublicModel(id: string) {
    return this.prisma.model_configs.findFirst({
      where: { id, visibility: ModelVisibility.public },
      include: modelWithMembershipInclude,
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

  createWithAllowedMembershipLevels(
    data: Prisma.model_configsUncheckedCreateInput,
    allowedMembershipLevelIds: string[],
  ) {
    return this.prisma.$transaction(async (tx) => {
      const model = await tx.model_configs.create({ data });

      if (allowedMembershipLevelIds.length > 0) {
        await tx.model_config_membership_levels.createMany({
          data: allowedMembershipLevelIds.map((levelId) => ({
            modelConfigId: model.id,
            levelId,
          })),
          skipDuplicates: true,
        });
      }

      return tx.model_configs.findUnique({
        where: { id: model.id },
        include: modelWithMembershipInclude,
      });
    });
  }

  update(id: string, data: Prisma.model_configsUncheckedUpdateInput) {
    return this.prisma.model_configs.update({ where: { id }, data });
  }

  async updateWithAllowedMembershipLevels(
    id: string,
    data: Prisma.model_configsUncheckedUpdateInput,
    allowedMembershipLevelIds?: string[],
  ) {
    return this.prisma.$transaction(async (tx) => {
      if (allowedMembershipLevelIds !== undefined) {
        await tx.model_config_membership_levels.deleteMany({
          where: { modelConfigId: id },
        });
      }

      const updated = await tx.model_configs.update({ where: { id }, data });

      if (allowedMembershipLevelIds?.length) {
        await tx.model_config_membership_levels.createMany({
          data: allowedMembershipLevelIds.map((levelId) => ({
            modelConfigId: id,
            levelId,
          })),
          skipDuplicates: true,
        });
      }

      return tx.model_configs.findUnique({
        where: { id: updated.id },
        include: modelWithMembershipInclude,
      });
    });
  }

  delete(id: string) {
    return this.prisma.model_configs.delete({ where: { id } });
  }
}
