import { Injectable, Logger } from '@nestjs/common';
import { safeFetch } from '@autix/ai-adapters/core';
import { CloudflareR2Service } from '../../platform/storage/cloudflare-r2.service';

@Injectable()
export class VideoAssetPersistenceService {
  private readonly logger = new Logger(VideoAssetPersistenceService.name);

  constructor(private readonly r2Service: CloudflareR2Service) {}

  async persistProviderVideo(
    sourceUrl: string | undefined,
    generationId: string,
  ): Promise<string | null> {
    if (!sourceUrl) return null;

    // 3 次重试 + 1s/2s 指数退避；失败返回 null，避免保留 24h 过期的供应商源链接。
    const MAX_ATTEMPTS = 3;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        // SSRF 防护：供应商回源地址抓取前校验，拒绝内网/元数据地址。
        const response = await safeFetch(sourceUrl);
        if (!response.ok) {
          throw new Error(`fetch source failed: HTTP ${response.status}`);
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        const result = await this.r2Service.uploadBuffer(buffer, {
          contentType: 'video/mp4',
          folder: 'amux-studio/video-generations',
          ext: 'mp4',
        });
        return result.publicUrl;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `R2 upload attempt ${attempt}/${MAX_ATTEMPTS} failed for generation=${generationId}: ${msg}`,
        );
        if (attempt === MAX_ATTEMPTS) return null;
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }

    return null;
  }
}
