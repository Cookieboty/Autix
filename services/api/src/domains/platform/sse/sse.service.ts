// services/api/src/sse/sse.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { AppLogger } from '../common/app-logger';
import { runInJobContext } from '../common/job-context';
import { Interval, Cron } from '@nestjs/schedule';
import { Response } from 'express';
import { SseRepository } from './sse.repository';

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
  private readonly logger = new AppLogger(SseService.name);
  // Map<userId, Set<Response>> — 一个用户一个 Set，所有 Tab 共用
  private readonly connections = new Map<string, Set<Response>>();

  constructor(private readonly repository: SseRepository) {}

  onModuleInit() {
    this.logger.log('initialized');
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
  addConnection(userId: string, res: Response): void {
    if (!this.connections.has(userId)) {
      this.connections.set(userId, new Set());
    }
    this.connections.get(userId)!.add(res);
    this.logger.log(`connection added for user=${userId}, total=${this.connections.get(userId)!.size}`);
  }

  /**
   * 移除 SSE 连接
   */
  removeConnection(userId: string, res: Response): void {
    const set = this.connections.get(userId);
    if (set) {
      set.delete(res);
      this.logger.log(`connection removed for user=${userId}, remaining=${set.size}`);
    }
  }

  /**
   * 发送事件给指定用户的所有 Tab
   * 同时写入数据库持久化
   */
  async emit(userId: string, event: TaskEventPayload): Promise<void> {
    // 1. 持久化到 DB（失败不影响实时推送）
    try {
      await this.repository.createTaskEvent(userId, event);
    } catch (err) {
      this.logger.error('failed to persist task event', err instanceof Error ? err.stack : String(err));
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
  async sweepInactiveUsers(): Promise<void> {
    return runInJobContext({ name: 'platform.sseCleanupIdle', logger: this.logger }, async () => {
      let cleaned = 0;
      for (const [userId, set] of this.connections.entries()) {
        if (set.size === 0) {
          this.connections.delete(userId);
          cleaned++;
        }
      }
      if (cleaned > 0) {
        this.logger.log(`swept ${cleaned} inactive user entries`);
      }
    });
  }

  @Cron('0 3 * * *') // 每天凌晨 3 点
  async cleanupTaskEvents(): Promise<void> {
    return runInJobContext({ name: 'platform.sseDailyReport', logger: this.logger }, async () => {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      let totalDeleted = 0;
      try {
        while (true) {
          const result = await this.repository.deleteTaskEventsOlderThan(cutoff);
          if (result === 0) break;
          totalDeleted += result;
        }
      } catch (err) {
        this.logger.error('Failed to delete task events', err instanceof Error ? err.stack : String(err));
        return;
      }
      if (totalDeleted > 0) {
        this.logger.log(`Deleted ${totalDeleted} task events older than 30 days`);
      }
    });
  }
}
