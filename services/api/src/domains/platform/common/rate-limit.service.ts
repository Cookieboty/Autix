import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { RateLimitRepository } from './rate-limit.repository';

export type RateLimitDimension = {
  key: string;
  windowMs: number;
  limit: number;
};

export class RateLimitedException extends HttpException {
  constructor(
    public readonly retryAfterMs: number,
  ) {
    super(
      {
        code: 'TOO_MANY_REQUESTS',
        message: 'Too many requests',
        retryAfterMs,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

@Injectable()
export class RateLimitService {
  constructor(private readonly repository: RateLimitRepository) {}

  /**
   * 事务原子多维消费：所有 dimensions 全部通过才写计数；任一失败则整体回滚并抛 429。
   * dimension.key 建议编码格式："<action>:<scope>:<value>"，例如 "otp-request:emailhash:xxxx"。
   */
  async consume(dimensions: RateLimitDimension[]): Promise<void> {
    if (dimensions.length === 0) return;
    const result = await this.repository.consume(dimensions);
    if (result.blockedKey) {
      throw new RateLimitedException(result.retryAfterMs ?? 0);
    }
  }

  /**
   * 只读检查是否被限流，不写计数。适合 dry-run 或前置探测。
   */
  async peek(dimension: RateLimitDimension): Promise<{ blocked: boolean; retryAfterMs: number }> {
    return this.repository.peek(dimension);
  }
}
