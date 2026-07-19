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

    /**
     * key 按 generationId 确定，不用随机名 —— 这是并发安全的关键。
     *
     * 回调与 30s 轮询会同时收敛同一条 generation（applyTaskStatus 开头的守卫读的是
     * 传进来的快照、无锁，两边都会放行），随机 key 时两边各传一个对象：generation.videoUrl
     * 指向后写的那个、素材库指向先写的那个（createMany skipDuplicates 丢弃了后者），
     * 内容一样却对不上，还多一个没人回收的孤儿。
     *
     * 用同一个 key 后两边写的是同一个对象、同样的字节，PutObject 覆盖写是原子的：
     * 不一致与孤儿同时消失，且不需要抢占锁——也就不会有「抢占者中途崩掉、行永远卡在
     * running 没人再捡」的活性风险。代价只是偶尔重复一次下载/上传的带宽。
     *
     * generation 与行 1:1（重新生成是新行新 id，多变体各自成行），不存在跨生成撞 key。
     */
    const upload =
      kind === 'video'
        ? {
            contentType: 'video/mp4',
            folder: 'amux-studio/video-generations',
            ext: 'mp4',
            fileName: generationId,
          }
        : {
            contentType: 'image/jpeg',
            folder: 'amux-studio/video-frames',
            ext: 'jpg',
            fileName: `${generationId}-last`,
          };

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
