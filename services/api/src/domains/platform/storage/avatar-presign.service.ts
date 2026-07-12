import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudflareR2Service } from './cloudflare-r2.service';
import { AVATAR_UPLOAD_LIMITS, type AvatarPresignInput, type AvatarPresignResult } from '@autix/domain';

/**
 * T16: 头像上传 reservation 服务（reservation-then-consume 模式的 step 1）。
 *
 * 单一职责：
 * 1. 生成 R2 presigned PUT URL（走 CloudflareR2Service）
 * 2. 事务内 INSERT `pending_uploads(purpose=AVATAR, status=PENDING, expiresAt=+ttl)`
 * 3. 返回 domain 契约的 AvatarPresignResult
 *
 * 关键约束：
 * - 强制 folder=`avatars/<userId>`，让 storage-cleanup 的 keyBelongsToOwner 归属校验能通过
 *   （storage-cleanup.service.ts#keyBelongsToOwner 按 `[/\-_.]` 分段查找 userId）
 * - contentType 白名单已由 DTO 校验；这里再兜底一次做深度防御
 * - expiresAt 与 pending_uploads.expiresAt 严格对齐（同一个 Date 实例），
 *   避免时钟漂移导致前端本地判断过期时机与后端 cron 不一致
 */
@Injectable()
export class AvatarPresignService {
  private readonly logger = new Logger(AvatarPresignService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly r2: CloudflareR2Service,
  ) {}

  async presign(userId: string, input: AvatarPresignInput): Promise<AvatarPresignResult> {
    if (!AVATAR_UPLOAD_LIMITS.allowedContentTypes.includes(input.contentType as never)) {
      throw new BadRequestException(`不支持的头像上传类型: ${input.contentType}`);
    }

    // 走 R2 presign：folder 强制拼进 userId，保证 keyBelongsToOwner 分段校验成立
    const { uploadUrl, publicUrl, key } = await this.r2.createPresignedUpload({
      fileName: input.fileName,
      contentType: input.contentType,
      folder: `avatars/${userId}`,
      userId,
      sizeBytes: input.sizeBytes,
    });

    const expiresAt = new Date(Date.now() + AVATAR_UPLOAD_LIMITS.reservationTtlSeconds * 1000);

    await this.prisma.pending_uploads.create({
      data: {
        ownerUserId: userId,
        storageKey: key,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
        purpose: 'AVATAR',
        status: 'PENDING',
        expiresAt,
      },
    });

    this.logger.log(`avatar presign issued: userId=${userId} key=${key} expiresAt=${expiresAt.toISOString()}`);

    return {
      uploadUrl,
      storageKey: key,
      publicUrl,
      expiresAt: expiresAt.toISOString(),
    };
  }
}
