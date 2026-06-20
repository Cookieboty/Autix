import { Injectable } from '@nestjs/common';
import { ResourceType } from '../platform/prisma/generated';
import { PrismaService } from '../platform/prisma/prisma.service';

export interface MarketplaceResourceRow {
  id: string;
  title: string;
  pointsCost?: number | null;
  [key: string]: unknown;
}

export interface MarketplaceResourceRef {
  resourceType: ResourceType;
  resourceId: string;
}

type ResourceDelegate = {
  findUnique: (args: {
    where: { id: string };
  }) => Promise<MarketplaceResourceRow | null>;
  findMany: (args: {
    where: { id: { in: string[] } };
  }) => Promise<MarketplaceResourceRow[]>;
  update: (args: {
    where: { id: string };
    data: { useCount: { increment: number } };
  }) => Promise<MarketplaceResourceRow>;
};

@Injectable()
export class MarketplaceResourceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(
    type: ResourceType,
    id: string,
  ): Promise<MarketplaceResourceRow | null> {
    const delegate = this.delegateFor(type);
    if (!delegate) return null;
    return delegate.findUnique({ where: { id } });
  }

  findManyByType(
    type: ResourceType,
    ids: string[],
  ): Promise<MarketplaceResourceRow[]> {
    if (ids.length === 0) return Promise.resolve([]);
    const delegate = this.delegateFor(type);
    if (!delegate) return Promise.resolve([]);
    return delegate.findMany({ where: { id: { in: ids } } });
  }

  async attachResources<T extends MarketplaceResourceRef>(
    rows: T[],
  ): Promise<Array<T & { resource: MarketplaceResourceRow | undefined }>> {
    const grouped = this.groupResourceIds(rows);
    const detailMap = new Map<string, MarketplaceResourceRow>();

    for (const [type, ids] of grouped) {
      const items = await this.findManyByType(type, ids);
      for (const item of items) {
        detailMap.set(this.key(type, item.id), item);
      }
    }

    return rows.map((row) => ({
      ...row,
      resource: detailMap.get(this.key(row.resourceType, row.resourceId)),
    }));
  }

  async incrementUseCount(type: ResourceType, id: string) {
    const delegate = this.usageDelegateFor(type);
    if (!delegate) return;

    await delegate.update({
      where: { id },
      data: { useCount: { increment: 1 } },
    });
  }

  private groupResourceIds<T extends MarketplaceResourceRef>(rows: T[]) {
    const grouped = new Map<ResourceType, string[]>();
    for (const row of rows) {
      const ids = grouped.get(row.resourceType) ?? [];
      ids.push(row.resourceId);
      grouped.set(row.resourceType, ids);
    }
    return grouped;
  }

  private key(type: ResourceType, id: string) {
    return `${type}:${id}`;
  }

  private usageDelegateFor(type: ResourceType): ResourceDelegate | undefined {
    if (
      type !== ResourceType.SKILL &&
      type !== ResourceType.MCP &&
      type !== ResourceType.AGENT
    ) {
      return undefined;
    }
    return this.delegateFor(type);
  }

  private delegateFor(type: ResourceType): ResourceDelegate | undefined {
    switch (type) {
      case ResourceType.SKILL:
        return this.prisma.skills as unknown as ResourceDelegate;
      case ResourceType.MCP:
        return this.prisma.mcp_servers as unknown as ResourceDelegate;
      case ResourceType.AGENT:
        return this.prisma.agents as unknown as ResourceDelegate;
      case ResourceType.IMAGE_TEMPLATE:
        return this.prisma.image_templates as unknown as ResourceDelegate;
      case ResourceType.VIDEO_TEMPLATE:
        return this.prisma.video_templates as unknown as ResourceDelegate;
    }
  }
}
