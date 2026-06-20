import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../platform/prisma/prisma.service';
import type { generation_pricing_rules } from '../../../platform/prisma/generated';

@Injectable()
export class PricingRuleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveRules(): Promise<generation_pricing_rules[]> {
    return this.prisma.generation_pricing_rules.findMany({
      where: { isActive: true },
      orderBy: [{ taskType: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async findById(id: string): Promise<generation_pricing_rules | null> {
    return this.prisma.generation_pricing_rules.findUnique({ where: { id } });
  }

  async findCandidatesForTask(
    taskType: string,
    now = new Date(),
  ): Promise<generation_pricing_rules[]> {
    return this.prisma.generation_pricing_rules.findMany({
      where: {
        taskType,
        isActive: true,
        OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: now } }],
        AND: [{ OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }] }],
      },
      orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
    });
  }
}
