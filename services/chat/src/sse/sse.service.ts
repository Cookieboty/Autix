// services/chat/src/sse/sse.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Interval, Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

export interface TaskEventPayload {
  id: string;
  taskType: string;
  taskId: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  message?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

@Injectable()
export class SseService implements OnModuleInit, OnModuleDestroy {
  // Map<userId, Set<Response>> — 一个用户一个 Set，所有 Tab 共用
  private readonly connections = new Map<string, Set<any>>();

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    console.log('[SseService] initialized');
  }

  onModuleDestroy() {
    // 清理所有连接
    for (const [, res] of this.connections) {
      for (const r of res) {
        r.end();
      }
    }
    this.connections.clear();
  }

  /**
   * 添加 SSE 连接
   */
  addConnection(userId: string, res: any): void {
    if (!this.connections.has(userId)) {
      this.connections.set(userId, new Set());
    }
    this.connections.get(userId)!.add(res);
    console.log(`[SseService] connection added for user=${userId}, total=${this.connections.get(userId)!.size}`);
  }

  /**
   * 移除 SSE 连接
   */
  removeConnection(userId: string, res: any): void {
    const set = this.connections.get(userId);
    if (set) {
      set.delete(res);
      console.log(`[SseService] connection removed for user=${userId}, remaining=${set.size}`);
    }
  }

  /**
   * 发送事件给指定用户的所有 Tab
   * 同时写入数据库持久化
   */
  async emit(userId: string, event: TaskEventPayload): Promise<void> {
    // 1. 持久化到 DB（失败不影响实时推送）
    try {
      await this.prisma.taskEvent.create({
        data: {
          id: event.id,
          userId,
          taskType: event.taskType,
          taskId: event.taskId,
          status: event.status,
          message: event.message ?? undefined,
          metadata: (event.metadata as any) ?? undefined,
          createdAt: new Date(event.createdAt),
        },
      });
    } catch (err) {
      console.error('[SseService] failed to persist task event:', err);
    }

    // 2. 实时推送给在线 Tab
    const set = this.connections.get(userId);
    if (set) {
      const payload = JSON.stringify(event);
      for (const res of set) {
        res.write(`event: task\ndata: ${payload}\n\n`);
      }
    }
  }

  /**
   * 定期清理离线用户的 Map entry，防止内存泄漏
   */
  @Interval(300000) // 5 minutes
  sweepInactiveUsers(): void {
    let cleaned = 0;
    for (const [userId, set] of this.connections.entries()) {
      if (set.size === 0) {
        this.connections.delete(userId);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      console.log(`[SseService] swept ${cleaned} inactive user entries`);
    }
  }

  @Cron('0 3 * * *') // 每天凌晨 3 点
  async cleanupTaskEvents(): Promise<void> {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    let totalDeleted = 0;
    try {
      while (true) {
        const result = await this.prisma.$executeRaw`
          DELETE FROM task_events
          WHERE id IN (
            SELECT id FROM task_events
            WHERE created_at < ${cutoff}
            LIMIT 10000
          )
        `;
        if (result === 0) break;
        totalDeleted += result;
      }
    } catch (err) {
      console.error('[Cleanup] Failed to delete task events:', err);
      return;
    }
    if (totalDeleted > 0) {
      console.log(`[Cleanup] Deleted ${totalDeleted} task events older than 30 days`);
    }
  }
}
