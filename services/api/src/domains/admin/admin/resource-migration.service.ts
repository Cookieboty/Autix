import { Injectable } from '@nestjs/common';
import { AppLogger } from '../../platform/common/app-logger';
import { safeFetch } from '@autix/ai-adapters/core';
import { CloudflareR2Service } from '../../platform/storage/cloudflare-r2.service';
import { isHttpUrl, isInStationMediaUrl } from '../../creation/gallery/gallery.helpers';

/** Fields whose URLs should be re-hosted to R2 on import (actual media assets). */
export const MEDIA_FIELDS = ['coverImage', 'exampleImages', 'exampleMedia'] as const;

export type ResourcePayload = Record<string, unknown>;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

@Injectable()
export class ResourceMigrationService {
  private readonly logger = new AppLogger(ResourceMigrationService.name);

  constructor(private readonly r2: CloudflareR2Service) {}

  /**
   * 薄委托：URL 合法性判定统一收敛到 gallery.helpers.isHttpUrl（WHATWG `new URL()` +
   * protocol 白名单），不再自行维护一套裸正则。历史上这里曾是大小写敏感的
   * `/^https?:\/\/.+/`，与导入侧的 assertSource 语义不一致（`HTTP://x/a.png` 会被导入
   * 放行、却被这里判定为不合法），导致该类作品永久卡在 PENDING。见 gallery.helpers.ts
   * 中 isHttpUrl 的文档与两侧同源性测试（resource-migration.service.spec.ts）。
   */
  isUrl(value: string): boolean {
    return isHttpUrl(value);
  }

  /**
   * Download a remote file and re-upload it to R2, returning the new public URL.
   */
  async migrateUrl(url: string, folder: string): Promise<string> {
    this.logger.log(`[migrate] downloading: ${url}`);
    // SSRF 防护：管理端导入的任意 URL 抓取前须校验，拒绝内网/元数据地址。
    const response = await safeFetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download ${url}: ${response.status}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType =
      response.headers.get('content-type') || 'application/octet-stream';
    const ext = this.extFromContentType(contentType, url);
    const result = await this.r2.uploadBuffer(buffer, {
      contentType,
      folder,
      ext,
    });
    return result.publicUrl;
  }

  /**
   * Recursively walk a template payload and migrate every URL-looking field to R2.
   * Migration failures are collected as warnings; the original value is kept.
   */
  async migrateTemplateData(
    data: ResourcePayload,
    folder: string,
  ): Promise<{ data: ResourcePayload; errors: string[] }> {
    const errors: string[] = [];
    const result: ResourcePayload = { ...data };

    for (const [key, value] of Object.entries(result)) {
      try {
        if (typeof value === 'string' && this.isUrl(value)) {
          result[key] = await this.migrateUrl(value, `${folder}/${key}`);
        } else if (Array.isArray(value)) {
          result[key] = await Promise.all(
            value.map(async (item, index) => {
              if (typeof item === 'string' && this.isUrl(item)) {
                try {
                  return await this.migrateUrl(item, `${folder}/${key}/${index}`);
                } catch (err: unknown) {
                  const message = errorMessage(err);
                  this.logger.warn(
                    `Failed to migrate ${key}[${index}]: ${message}`,
                  );
                  errors.push(`${key}[${index}]: ${message}`);
                  return item;
                }
              }
              return item;
            }),
          );
        } else if (value && typeof value === 'object' && !Array.isArray(value)) {
          const nested = await this.migrateTemplateData(
            value as ResourcePayload,
            `${folder}/${key}`,
          );
          result[key] = nested.data;
          errors.push(...nested.errors);
        }
      } catch (err: unknown) {
        const message = errorMessage(err);
        this.logger.warn(`Failed to migrate ${key}: ${message}`);
        errors.push(`${key}: ${message}`);
      }
    }

    return { data: result, errors };
  }

  /**
   * Migrate only the given media fields to R2, leaving every other field
   * untouched. Used by the gallery media-migration worker to re-host
   * cover/media URLs while preserving the rest of the payload.
   */
  async migrateMediaFields(
    data: ResourcePayload,
    folder: string,
    fields: readonly string[] = MEDIA_FIELDS,
  ): Promise<{ data: ResourcePayload; errors: string[] }> {
    const errors: string[] = [];
    const result: ResourcePayload = { ...data };
    // 幂等：已站内化的 URL 直接跳过。R2 链接本身也是合法 http URL，若只判 isUrl，
    // 重试时会把已搬好的对象从 R2 下载再传回 R2，产生重复对象与孤儿垃圾。
    const r2Base = await this.r2.getPublicBaseUrl();
    // 三档判定（Fix 1b，纵深防御——主防线是 gallery.helpers.assertSource 在导入时拒绝）：
    //   非字符串 / null / 空串        → 跳过，不报错（coverImage 允许为 null）
    //   字符串但不是合法 http(s) URL  → push error（不再静默跳过，否则 errors.length===0
    //                                    会让从未被搬运/校验过的"媒体"被当作搬运成功而自动发布）
    //   合法 http(s) URL：已站内       → 跳过不报错（幂等，见下方 isInStationMediaUrl）
    //                     非站内       → 搬运
    const isEmpty = (value: unknown): boolean =>
      value == null || (typeof value === 'string' && value.trim() === '');
    const needsMigration = (value: unknown): value is string =>
      typeof value === 'string' && this.isUrl(value) && !isInStationMediaUrl(value, [r2Base]);

    for (const key of fields) {
      const value = result[key];
      if (Array.isArray(value)) {
        result[key] = await Promise.all(
          value.map(async (item, index) => {
            if (isEmpty(item)) return item;
            if (typeof item === 'string' && !this.isUrl(item)) {
              errors.push(`${key}[${index}]: not a valid http(s) URL`);
              return item;
            }
            if (!needsMigration(item)) return item;
            try {
              return await this.migrateUrl(item, `${folder}/${key}/${index}`);
            } catch (err: unknown) {
              const message = errorMessage(err);
              this.logger.warn(`Failed to migrate ${key}[${index}]: ${message}`);
              errors.push(`${key}[${index}]: ${message}`);
              return item;
            }
          }),
        );
      } else if (isEmpty(value)) {
        // 跳过：非字符串/null/空串
      } else if (typeof value === 'string' && !this.isUrl(value)) {
        errors.push(`${key}: not a valid http(s) URL`);
      } else if (needsMigration(value)) {
        try {
          result[key] = await this.migrateUrl(value, `${folder}/${key}`);
        } catch (err: unknown) {
          const message = errorMessage(err);
          this.logger.warn(`Failed to migrate ${key}: ${message}`);
          errors.push(`${key}: ${message}`);
        }
      }
    }

    return { data: result, errors };
  }

  private extFromContentType(contentType: string, url: string): string {
    const map: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'video/mp4': 'mp4',
      'video/webm': 'webm',
    };
    if (map[contentType]) return map[contentType];
    const urlExt = url.split('?')[0].split('.').pop();
    if (urlExt && urlExt.length <= 5 && /^[a-z0-9]+$/i.test(urlExt)) return urlExt;
    return 'bin';
  }
}
