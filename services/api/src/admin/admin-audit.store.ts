import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AdminAuditEntry {
  id: string;
  action: string;
  actorId: string;
  at: string;
  payload: Record<string, unknown>;
}

export interface AdminAuditQuery {
  action?: string;
  actorId?: string;
  limit?: number;
  cursor?: string;
}

@Injectable()
export class AdminAuditStore {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: Omit<AdminAuditEntry, 'id'>): Promise<AdminAuditEntry> {
    const row = await this.prisma.admin_audit_logs.create({
      data: {
        action: entry.action,
        actorId: entry.actorId,
        at: new Date(entry.at),
        payload: entry.payload as any,
      },
    });
    return {
      id: row.id,
      action: row.action,
      actorId: row.actorId,
      at: row.at.toISOString(),
      payload: (row.payload as Record<string, unknown>) ?? {},
    };
  }

  async query(q: AdminAuditQuery = {}): Promise<{
    items: AdminAuditEntry[];
    total: number;
    nextCursor: string | null;
  }> {
    const limit = Math.min(Math.max(q.limit ?? 50, 1), 200);

    const where: Record<string, unknown> = {};
    if (q.action) where.action = q.action;
    if (q.actorId) where.actorId = q.actorId;
    if (q.cursor) {
      where.createdAt = { lt: (await this.prisma.admin_audit_logs.findUnique({ where: { id: q.cursor } }))?.createdAt };
    }

    const [items, total] = await Promise.all([
      this.prisma.admin_audit_logs.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      this.prisma.admin_audit_logs.count({ where: q.cursor ? undefined : where }),
    ]);

    const mapped: AdminAuditEntry[] = items.map((row) => ({
      id: row.id,
      action: row.action,
      actorId: row.actorId,
      at: row.at.toISOString(),
      payload: (row.payload as Record<string, unknown>) ?? {},
    }));

    const nextCursor = mapped.length === limit ? mapped[mapped.length - 1].id : null;
    return { items: mapped, total, nextCursor };
  }
}
