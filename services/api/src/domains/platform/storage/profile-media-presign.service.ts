import { BadRequestException, Injectable } from '@nestjs/common';
import { AppLogger } from '../common/app-logger';
import { PrismaService } from '../prisma/prisma.service';
import { CloudflareR2Service } from './cloudflare-r2.service';
import {
  AVATAR_UPLOAD_LIMITS,
  BANNER_UPLOAD_LIMITS,
  type AvatarPresignInput,
  type AvatarPresignResult,
} from '@autix/domain';

/**
 * T16: 个人资料图片上传 reservation 服务（reservation-then-consume 模式的 step 1）。
 *
 * 覆盖头像（purpose=AVATAR，前缀 `avatars/`）与 profile banner（purpose=BANNER，前缀
 * `banners/`）—— 两者流水完全同构，差别只有前缀 / purpose / 体积上限，故共用一份实现，
 * 由下面的 MEDIA_KINDS 表描述差异。
 *
 * 单一职责：
 * 1. 生成 R2 presigned PUT URL（走 CloudflareR2Service）
 * 2. 事务内 INSERT `pending_uploads(purpose, status=PENDING, expiresAt=+ttl)`
 * 3. 返回 domain 契约的 AvatarPresignResult
 *
 * 关键约束：
 * - 强制 folder=`<前缀>/<userId>`，让 storage-cleanup 的 keyBelongsToOwner 归属校验能通过
 *   （storage-cleanup.service.ts#keyBelongsToOwner 按 `[/\-_.]` 分段查找 userId）
 * - contentType 白名单已由 DTO 校验；这里再兜底一次做深度防御
 * - expiresAt 与 pending_uploads.expiresAt 严格对齐（同一个 Date 实例），
 *   避免时钟漂移导致前端本地判断过期时机与后端 cron 不一致
 */
export type ProfileMediaKind = 'AVATAR' | 'BANNER';

const MEDIA_KINDS = {
  AVATAR: { folder: 'avatars', limits: AVATAR_UPLOAD_LIMITS, label: 'Avatar' },
  BANNER: { folder: 'banners', limits: BANNER_UPLOAD_LIMITS, label: 'banner' },
} as const;

@Injectable()
export class ProfileMediaPresignService {
  private readonly logger = new AppLogger(ProfileMediaPresignService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly r2: CloudflareR2Service,
  ) {}

  async presign(
    userId: string,
    input: AvatarPresignInput,
    kind: ProfileMediaKind = 'AVATAR',
  ): Promise<AvatarPresignResult> {
    const spec = MEDIA_KINDS[kind];
    if (!spec.limits.allowedContentTypes.includes(input.contentType as never)) {
      throw new BadRequestException(`Unsupported ${spec.label} upload type: ${input.contentType}`);
    }
    // DTO 已按 kind 校验体积，这里兜底一次（深度防御：别的调用方绕过 DTO 时仍成立）
    if (input.sizeBytes > spec.limits.maxSizeBytes) {
      throw new BadRequestException(`${spec.label} exceeds the size limit`);
    }

    // 走 R2 presign：folder 强制拼进 userId，保证 keyBelongsToOwner 分段校验成立
    const { uploadUrl, publicUrl, key } = await this.r2.createPresignedUpload({
      fileName: input.fileName,
      contentType: input.contentType,
      folder: `${spec.folder}/${userId}`,
      userId,
      sizeBytes: input.sizeBytes,
    });

    const expiresAt = new Date(Date.now() + spec.limits.reservationTtlSeconds * 1000);

    await this.prisma.pending_uploads.create({
      data: {
        ownerUserId: userId,
        storageKey: key,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
        purpose: kind,
        status: 'PENDING',
        expiresAt,
      },
    });

    this.logger.log(
      `${spec.folder} presign issued: userId=${userId} key=${key} expiresAt=${expiresAt.toISOString()}`,
    );

    return {
      uploadUrl,
      storageKey: key,
      publicUrl,
      expiresAt: expiresAt.toISOString(),
    };
  }
}
