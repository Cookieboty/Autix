import { IsIn, IsInt, IsString, Max, MaxLength, Min } from 'class-validator';
import { AVATAR_UPLOAD_LIMITS, type AvatarPresignInput } from '@autix/domain';

/**
 * T16: `POST /storage/avatar-presign` DTO。
 *
 * - `contentType` 用 IsIn 白名单硬阻断 svg/html/xml/js —— 与 domain `AVATAR_UPLOAD_LIMITS.allowedContentTypes` 保持一致
 * - `sizeBytes` 必填且不超过 5MB；R2 presigned PUT 把该值绑定为 Content-Length
 * - `fileName` 只取扩展名，长度限制防拼装攻击
 */
export class AvatarPresignDto implements AvatarPresignInput {
  @IsString()
  @MaxLength(256)
  fileName!: string;

  @IsString()
  @IsIn(AVATAR_UPLOAD_LIMITS.allowedContentTypes as unknown as string[])
  contentType!: string;

  @IsInt()
  @Min(1)
  @Max(AVATAR_UPLOAD_LIMITS.maxSizeBytes)
  sizeBytes!: number;
}
