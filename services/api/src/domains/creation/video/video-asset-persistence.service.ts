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
    return this.persistProviderAsset(sourceUrl, generationId, 'video');
  }

  /**
   * 末帧图转存。
   *
   * 与视频同等重要：lastFrameUrl 之前是**原样透传供应商地址**存进
   * video_clip_generations.lastFrameUrl，再被当作素材库封面（thumbnailUrl）和链式
   * 生成的下一段输入图。供应商链接 24h 过期，于是素材库里的视频封面会在一天后集体裂图，
   * 且因为素材行已存在（skipDuplicates + 唯一索引），回填脚本也修不回来。
   *
   * 失败返回 null：封面缺失只是少张图，不该让一次已经成功的生成被判失败
   * （视频本体转存失败才会 markGenerationFailed）。
   */
  async persistProviderImage(
    sourceUrl: string | undefined,
    generationId: string,
  ): Promise<string | null> {
    return this.persistProviderAsset(sourceUrl, generationId, 'image');
  }

  private async persistProviderAsset(
    sourceUrl: string | undefined,
    generationId: string,
    kind: 'video' | 'image',
  ): Promise<string | null> {
    if (!sourceUrl) return null;

    const upload =
      kind === 'video'
        ? { contentType: 'video/mp4', folder: 'amux-studio/video-generations', ext: 'mp4' }
        : { contentType: 'image/jpeg', folder: 'amux-studio/video-frames', ext: 'jpg' };

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
        const result = await this.r2Service.uploadBuffer(buffer, upload);
        return result.publicUrl;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `R2 ${kind} upload attempt ${attempt}/${MAX_ATTEMPTS} failed for generation=${generationId}: ${msg}`,
        );
        if (attempt === MAX_ATTEMPTS) return null;
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }

    return null;
  }
}
