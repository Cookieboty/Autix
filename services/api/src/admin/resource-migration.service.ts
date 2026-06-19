import { Injectable, Logger } from '@nestjs/common';
import { CloudflareR2Service } from '../storage/cloudflare-r2.service';

/** Fields whose URLs should be re-hosted to R2 on import (actual media assets). */
export const MEDIA_FIELDS = ['coverImage', 'exampleImages', 'exampleMedia'] as const;

export type ResourcePayload = Record<string, unknown>;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

@Injectable()
export class ResourceMigrationService {
  private readonly logger = new Logger(ResourceMigrationService.name);

  constructor(private readonly r2: CloudflareR2Service) {}

  isUrl(value: string): boolean {
    return /^https?:\/\/.+/.test(value);
  }

  /**
   * Download a remote file and re-upload it to R2, returning the new public URL.
   */
  async migrateUrl(url: string, folder: string): Promise<string> {
    this.logger.log(`[migrate] downloading: ${url}`);
    const response = await fetch(url);
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
   * (e.g. originalUrl, authorUrl, externalMetadata) untouched so source
   * reference links are preserved.
   */
  async migrateMediaFields(
    data: ResourcePayload,
    folder: string,
    fields: readonly string[] = MEDIA_FIELDS,
  ): Promise<{ data: ResourcePayload; errors: string[] }> {
    const errors: string[] = [];
    const result: ResourcePayload = { ...data };

    for (const key of fields) {
      const value = result[key];
      if (typeof value === 'string' && this.isUrl(value)) {
        try {
          result[key] = await this.migrateUrl(value, `${folder}/${key}`);
        } catch (err: unknown) {
          const message = errorMessage(err);
          this.logger.warn(`Failed to migrate ${key}: ${message}`);
          errors.push(`${key}: ${message}`);
        }
      } else if (Array.isArray(value)) {
        result[key] = await Promise.all(
          value.map(async (item, index) => {
            if (typeof item === 'string' && this.isUrl(item)) {
              try {
                return await this.migrateUrl(item, `${folder}/${key}/${index}`);
              } catch (err: unknown) {
                const message = errorMessage(err);
                this.logger.warn(`Failed to migrate ${key}[${index}]: ${message}`);
                errors.push(`${key}[${index}]: ${message}`);
                return item;
              }
            }
            return item;
          }),
        );
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
