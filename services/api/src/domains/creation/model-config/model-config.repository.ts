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
  paramsSchema: true,
  pricingSchema: true,
  schemaVersion: true,
  description: true,
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

  findSystemModels() {
    // 管理端「系统模型配置」页（AdminGuard 保护）要能看到并管理**全部**模型，含 private——
    // 否则私有模型（如运营手动配的 doubao-seedance-2.0）在后台完全不可见，无法改可见性/密钥。
    // 可见性过滤只用于用户侧的 findAvailablePublicModels，不属于这里。
    return this.prisma.model_configs.findMany({
      orderBy: [{ type: 'asc' }, { priority: 'desc' }],
      select: modelSelectFields,
    });
  }

  findAvailablePublicModels() {
    return this.prisma.model_configs.findMany({
      where: { isActive: true, visibility: ModelVisibility.public },
      orderBy: [{ type: 'asc' }, { isDefault: 'desc' }, { priority: 'desc' }],
      select: modelSelectFields,
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
