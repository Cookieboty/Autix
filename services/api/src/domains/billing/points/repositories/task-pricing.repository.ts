import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../platform/prisma/prisma.service';
import type {
  task_definitions,
  task_model_bindings,
  pricing_discounts,
  Prisma,
} from '../../../platform/prisma/generated';

export interface ModelPricingConfig {
  id: string;
  name: string;
  paramsSchema: Prisma.JsonValue | null;
  pricingSchema: Prisma.JsonValue | null;
  schemaVersion: number;
}

@Injectable()
export class TaskPricingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findTaskDefinition(taskType: string): Promise<task_definitions | null> {
    return this.prisma.task_definitions.findUnique({ where: { taskType } });
  }

  async findBinding(taskType: string, modelConfigId: string): Promise<task_model_bindings | null> {
    return this.prisma.task_model_bindings.findUnique({
      where: { taskType_modelConfigId: { taskType, modelConfigId } },
    });
  }

  async findDefaultBinding(taskType: string): Promise<task_model_bindings | null> {
    return this.prisma.task_model_bindings.findFirst({
      where: { taskType, isDefault: true, isActive: true },
    });
  }

  async findModelPricingConfig(modelConfigId: string): Promise<ModelPricingConfig | null> {
    return this.prisma.model_configs.findUnique({
      where: { id: modelConfigId },
      select: { id: true, name: true, paramsSchema: true, pricingSchema: true, schemaVersion: true },
    });
  }

  async findActiveDiscounts(now: Date): Promise<pricing_discounts[]> {
    return this.prisma.pricing_discounts.findMany({
      where: {
        isActive: true,
        OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: now } }],
        AND: [{ OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }] }],
      },
    });
  }
}
