import { IsIn, IsInt, IsString, Max, MaxLength, Min } from 'class-validator';
import { BANNER_UPLOAD_LIMITS, type BannerPresignInput } from '@autix/domain';

/**
 * `POST /storage/banner-presign` DTO —— 与 AvatarPresignDto 同构，差别只有体积上限
 * （banner 是横幅大图，10MB；头像 5MB）。MIME 白名单共用同一份常量，svg/html/xml/js
 * 同样被硬阻断（存储型 XSS）。
 */
export class BannerPresignDto implements BannerPresignInput {
  @IsString()
  @MaxLength(256)
  fileName!: string;

  @IsString()
  @IsIn(BANNER_UPLOAD_LIMITS.allowedContentTypes as unknown as string[])
  contentType!: string;

  @IsInt()
  @Min(1)
  @Max(BANNER_UPLOAD_LIMITS.maxSizeBytes)
  sizeBytes!: number;
}
