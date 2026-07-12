import { Injectable } from '@nestjs/common';
import { createHmac } from 'crypto';

/**
 * 邮箱 HMAC 派生：用于限流键的 PII 脱敏。
 * - 输出 hex 64 字符（SHA-256）
 * - 必须使用独立 secret（EMAIL_HASH_HMAC_KEY），与 JWT_SECRET 隔离
 * - 输入统一 trim + lower 化后再 HMAC，避免 "A@x.com" 与 "a@x.com" 落到不同 bucket
 */
@Injectable()
export class EmailHashService {
  private readonly key: string;

  constructor() {
    const key = process.env.EMAIL_HASH_HMAC_KEY ?? '';
    if (!key) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('EMAIL_HASH_HMAC_KEY is required in production');
      }
      this.key = 'autix-dev-email-hash-hmac-key-do-not-use-in-production';
    } else {
      this.key = key;
    }
  }

  hash(email: string): string {
    const normalized = email.trim().toLowerCase();
    return createHmac('sha256', this.key).update(normalized).digest('hex');
  }

  /**
   * 遮蔽邮件展示：a***@example.com
   */
  static mask(email: string): string {
    const [local, domain] = email.split('@');
    if (!local || !domain) return email;
    const visible = local.slice(0, 1);
    return `${visible}${'*'.repeat(Math.max(local.length - 1, 1))}@${domain}`;
  }
}
