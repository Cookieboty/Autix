import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../platform/prisma/prisma.service';
import { Prisma } from '../../../platform/prisma/generated';
import type { PricingRuleWithComponents } from '../pricing-estimator';

const pricingRuleInclude: Prisma.generation_pricing_rulesInclude = {
  components: {
    where: { isActive: true },
    orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
  },
};

@Injectable()
export class PricingRuleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveRules(): Promise<PricingRuleWithComponents[]> {
    return this.prisma.generation_pricing_rules.findMany({
      where: { isActive: true },
      include: pricingRuleInclude,
      orderBy: [{ taskType: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findById(id: string): Promise<PricingRuleWithComponents | null> {
    return this.prisma.generation_pricing_rules.findUnique({
      where: { id },
      include: pricingRuleInclude,
    });
  }

  async findCandidatesForTask(
    taskType: string,
    now = new Date(),
  ): Promise<PricingRuleWithComponents[]> {
    return this.prisma.generation_pricing_rules.findMany({
      where: {
        taskType,
        isActive: true,
        OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: now } }],
        AND: [{ OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }] }],
      },
      include: pricingRuleInclude,
      orderBy: [{ priority: 'desc' }, { effectiveFrom: 'desc' }, { createdAt: 'desc' }],
    });
  }
}
