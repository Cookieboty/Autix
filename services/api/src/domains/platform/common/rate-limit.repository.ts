import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { RateLimitDimension } from './rate-limit.service';

class LimitExceeded extends Error {
  constructor(readonly key: string, readonly retryAfterMs: number) {
    super('rate limit exceeded');
  }
}

@Injectable()
export class RateLimitRepository {
  constructor(private readonly prisma: PrismaService) {}

  async consume(dimensions: RateLimitDimension[]): Promise<{ blockedKey?: string; retryAfterMs?: number }> {
    try {
      await this.prisma.$transaction(async (tx) => {
        const [{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT CURRENT_TIMESTAMP AS "now"`;
        for (const dimension of dimensions) {
          const bucketStart = new Date(Math.floor(now.getTime() / dimension.windowMs) * dimension.windowMs);
          const rows = await tx.$queryRaw<{ count: number }[]>`
            INSERT INTO "rate_limit_counters" ("dimension", "bucketStart", "count", "updatedAt")
            VALUES (${dimension.key}, ${bucketStart}, 1, CURRENT_TIMESTAMP)
            ON CONFLICT ("dimension", "bucketStart") DO UPDATE
            SET "count" = "rate_limit_counters"."count" + 1,
                "updatedAt" = CURRENT_TIMESTAMP
            WHERE "rate_limit_counters"."count" < ${dimension.limit}
            RETURNING "count"
          `;
          if (rows.length === 0) {
            throw new LimitExceeded(
              dimension.key,
              Math.max(bucketStart.getTime() + dimension.windowMs - now.getTime(), 0),
            );
          }
        }
      });
      return {};
    } catch (error) {
      if (error instanceof LimitExceeded) {
        return { blockedKey: error.key, retryAfterMs: error.retryAfterMs };
      }
      throw error;
    }
  }

  async peek(dimension: RateLimitDimension): Promise<{ blocked: boolean; retryAfterMs: number }> {
    const [{ now }] = await this.prisma.$queryRaw<{ now: Date }[]>`SELECT CURRENT_TIMESTAMP AS "now"`;
    const bucketStart = new Date(Math.floor(now.getTime() / dimension.windowMs) * dimension.windowMs);
    const current = await this.prisma.rate_limit_counters.findUnique({
      where: { dimension_bucketStart: { dimension: dimension.key, bucketStart } },
    });
    if (current && current.count >= dimension.limit) {
      return {
        blocked: true,
        retryAfterMs: Math.max(bucketStart.getTime() + dimension.windowMs - now.getTime(), 0),
      };
    }
    return { blocked: false, retryAfterMs: 0 };
  }

  /**
   * 清理早已过期的限流计数，保证磁盘有界（spec §3.2 D'''：后台 job 每小时/每天清理过期计数）。
   *
   * 表中未存 windowMs，因此按 `bucketStart` 的保守 cutoff 删除：只删 bucketStart 早于
   * `now - retainMs` 的行。默认 retainMs=2 天，远大于当前最大窗口（邮箱变更日限 24h），
   * 确保不会误删仍在计数的活跃窗口。
   */
  async deleteExpired(now: Date = new Date(), retainMs = 2 * 24 * 3600_000): Promise<number> {
    const cutoff = new Date(now.getTime() - retainMs);
    const result = await this.prisma.rate_limit_counters.deleteMany({
      where: { bucketStart: { lt: cutoff } },
    });
    return result.count;
  }
}
