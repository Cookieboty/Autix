import { Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';
import { CloudflareR2Service } from './cloudflare-r2.service';

/**
 * T18: 头像 server-side 图像预处理。
 *
 * 单一职责（consume 阶段调用）：
 * 1. 从 R2 下载用户 PUT 的原图（reservation.storageKey）
 * 2. 用 sharp resize 到 512×512 cover + strip metadata + 转 WebP quality 82
 * 3. 重新上传到 R2，folder=`avatars/${userId}`（保持 keyBelongsToOwner 归属校验成立）
 * 4. 返回 processed 的 `{ storageKey, publicUrl }`，供上层 consume 落 user.avatar/avatarStorageKey
 *
 * 关键设计：
 * - **降级策略**：任何一步失败（网络、非图片、sharp 崩溃）→ logger.warn + 返回 fallback，
 *   fallback = `{ storageKey: originalKey, publicUrl: originalPublicUrl, processed: false }`。
 *   主链路不阻断，用户仍然能"看到自己上传的头像"，只是没做 resize/strip。
 * - **尺寸硬防线**：AVATAR_UPLOAD_LIMITS 已保证 <=5MB；这里再兜一次上限，
 *   若 downloadObject 返回超预期大小的 buffer（外部误传或配置漂移），直接进降级路径。
 * - **strip metadata**：`.rotate()` 会读 EXIF orientation 应用旋转后**丢弃 EXIF**，
 *   sharp 默认 output 不带 metadata（除非显式 `.withMetadata()`），因此 GPS/时间戳
 *   一并抹除。
 * - **WebP 输出**：现代浏览器全支持；相比原始 PNG/JPG 可显著缩小 avatar 请求体积。
 */
@Injectable()
export class AvatarImageProcessor {
  private readonly logger = new Logger(AvatarImageProcessor.name);

  private readonly targetSize = 512;
  private readonly webpQuality = 82;
  private readonly maxSourceBytes = 5 * 1024 * 1024;

  constructor(private readonly r2: CloudflareR2Service) {}

  async processAndUpload(
    userId: string,
    originalKey: string,
  ): Promise<{ storageKey: string; publicUrl: string; processed: boolean }> {
    const fallback = async () => {
      const publicUrl = await this.r2.getPublicUrl(originalKey);
      return { storageKey: originalKey, publicUrl, processed: false };
    };

    try {
      const source = await this.r2.downloadObject(originalKey);
      if (source.byteLength === 0) {
        this.logger.warn(`avatar image processor: empty source key=${originalKey}, fallback to original`);
        return fallback();
      }
      if (source.byteLength > this.maxSourceBytes) {
        this.logger.warn(
          `avatar image processor: source too large (${source.byteLength}B > ${this.maxSourceBytes}B) key=${originalKey}, fallback to original`,
        );
        return fallback();
      }

      // sharp 处理：读 EXIF orientation → resize cover → 转 WebP → 默认丢弃 metadata
      const output = await sharp(source)
        .rotate()
        .resize(this.targetSize, this.targetSize, { fit: 'cover' })
        .webp({ quality: this.webpQuality })
        .toBuffer();

      const uploaded = await this.r2.uploadBuffer(output, {
        contentType: 'image/webp',
        folder: `avatars/${userId}`,
        ext: 'webp',
      });

      this.logger.log(
        `avatar image processor: processed userId=${userId} original=${originalKey} → processed=${uploaded.key} (${output.byteLength}B webp)`,
      );

      return {
        storageKey: uploaded.key,
        publicUrl: uploaded.publicUrl,
        processed: true,
      };
    } catch (err) {
      this.logger.warn(
        `avatar image processor: failed userId=${userId} key=${originalKey}: ${(err as Error).message}, fallback to original`,
      );
      return fallback();
    }
  }
}
