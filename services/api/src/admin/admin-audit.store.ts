import { Injectable } from '@nestjs/common';

/**
 * P2-A2: 后台操作审计内存存储。
 * 用环形缓冲（ring buffer）保存最近 N 条审计事件，避免一次 migration。
 * 后续要落库时，只需替换 record/query 实现即可。
 */
export interface AdminAuditEntry {
  id: number;
  action: string;
  actorId: string;
  at: string;
  payload: Record<string, unknown>;
}

export interface AdminAuditQuery {
  action?: string;
  actorId?: string;
  limit?: number;
  cursor?: number;
}

@Injectable()
export class AdminAuditStore {
  private static readonly DEFAULT_CAPACITY = 1000;

  private readonly capacity: number = AdminAuditStore.DEFAULT_CAPACITY;
  private buffer: AdminAuditEntry[] = [];
  private nextId = 1;

  record(entry: Omit<AdminAuditEntry, 'id'>): AdminAuditEntry {
    const full: AdminAuditEntry = { id: this.nextId++, ...entry };
    this.buffer.push(full);
    if (this.buffer.length > this.capacity) {
      this.buffer.splice(0, this.buffer.length - this.capacity);
    }
    return full;
  }

  query(q: AdminAuditQuery = {}): { items: AdminAuditEntry[]; total: number; nextCursor: number | null } {
    const limit = Math.min(Math.max(q.limit ?? 50, 1), 200);
    let filtered = this.buffer;
    if (q.action) filtered = filtered.filter((e) => e.action === q.action);
    if (q.actorId) filtered = filtered.filter((e) => e.actorId === q.actorId);

    // 倒序返回，最新在前；cursor 表示"返回 id 严格小于 cursor 的条目"
    const ordered = [...filtered].sort((a, b) => b.id - a.id);
    const sliced = q.cursor != null ? ordered.filter((e) => e.id < q.cursor!) : ordered;
    const items = sliced.slice(0, limit);
    const nextCursor = items.length === limit ? items[items.length - 1].id : null;
    return { items, total: filtered.length, nextCursor };
  }
}
