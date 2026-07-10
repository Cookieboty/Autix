import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../platform/prisma/prisma.service';
import type { Prisma } from '../../../platform/prisma/generated';

@Injectable()
export class PricingConfigAdminRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Backs `GET /admin/models/:id`: the full description locale map plus the raw schemas, for an operator to edit. */
  async findModelConfig(modelConfigId: string) {
    return this.prisma.model_configs.findUnique({
      where: { id: modelConfigId },
      select: { id: true, description: true, paramsSchema: true, pricingSchema: true, schemaVersion: true },
    });
  }

  /**
   * Returns null when the model does not exist so the service can surface a 404 instead of
   * letting Prisma's update-on-missing-row P2025 escape as an unhandled 500.
   *
   * schemaVersion increments on every write — PricingSnapshot.schemaVersion (quote.ts) is
   * copied into every hold's frozen snapshot for audit ("which schema version priced this
   * order"); if this counter never advanced it would always read 1 and the field would be a lie.
   */
  async updateModelSchemas(
    modelConfigId: string,
    data: { paramsSchema: Prisma.InputJsonValue; pricingSchema: Prisma.InputJsonValue },
  ) {
    const existing = await this.prisma.model_configs.findUnique({
      where: { id: modelConfigId },
      select: { schemaVersion: true },
    });
    if (!existing) return null;

    return this.prisma.model_configs.update({
      where: { id: modelConfigId },
      data: {
        paramsSchema: data.paramsSchema,
        pricingSchema: data.pricingSchema,
        schemaVersion: existing.schemaVersion + 1,
      },
      select: { id: true, paramsSchema: true, pricingSchema: true, schemaVersion: true },
    });
  }

  /** Same not-found-as-null contract as updateModelSchemas. */
  async updateModelDescription(modelConfigId: string, description: Prisma.InputJsonValue) {
    const existing = await this.prisma.model_configs.findUnique({
      where: { id: modelConfigId },
      select: { id: true },
    });
    if (!existing) return null;

    return this.prisma.model_configs.update({
      where: { id: modelConfigId },
      data: { description },
      select: { id: true, description: true },
    });
  }
}
