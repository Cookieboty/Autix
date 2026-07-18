import {
  Controller,
  Post,
  Body,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../identity/auth/jwt-auth.guard';
import { CurrentUser, getCurrentUserId } from '../../identity/auth/decorators/current-user.decorator';
import type { AuthUser, AvatarPresignResult, BannerPresignResult } from '@autix/domain';
import { CloudflareR2Service } from './cloudflare-r2.service';
import { ProfileMediaPresignService } from './profile-media-presign.service';
import { AvatarPresignDto } from './dto/avatar-presign.dto';
import { BannerPresignDto } from './dto/banner-presign.dto';

@UseGuards(JwtAuthGuard)
@Controller('storage')
export class StorageController {
  constructor(
    private readonly r2: CloudflareR2Service,
    private readonly profileMediaPresign: ProfileMediaPresignService,
  ) {}

  @Post('presign')
  async presign(
    @CurrentUser() user: AuthUser,
    @Body() body: { fileName: string; contentType: string; folder?: string },
  ) {
    const userId = getCurrentUserId(user);
    // 安全：`avatars/` 与 `banners/` 是个人资料图片专用命名空间（走 profile-media-presign，
    // 含 owner 归属校验 + cleanup 归属校验）。通用 presign 不得写入这些前缀，避免用户把对象
    // 塞进他人命名空间造成污染/绕过归属模型。
    if (body.folder && /^\/?(avatars|banners)(\/|$)/i.test(body.folder.trim())) {
      throw new BadRequestException('该目录不可用于通用上传');
    }
    const result = await this.r2.createPresignedUpload({
      fileName: body.fileName,
      contentType: body.contentType,
      folder: body.folder,
      userId,
    });
    return result;
  }

  @Post('upload-base64')
  async uploadBase64(
    @Body() body: { image: string; folder?: string },
  ) {
    // 注意：不再加 `u/${userId}/` 前缀——改变对象 key 路径会破坏按 URL 回源（R2 若按前缀配 CORS/公有访问）。
    // 按用户隔离应通过鉴权签名 GET 代理实现，而非 key 前缀（对象仍公有可读）。
    return this.r2.uploadBase64Image(body.image, body.folder ?? 'amux-studio/chat-uploads');
  }

  /**
   * T16: 头像上传 reservation 端点。
   * - 事务内落 pending_uploads，返回 presigned PUT URL + storageKey + publicUrl + expiresAt
   * - 前端拿到后 PUT 到 uploadUrl，然后 PATCH auth/profile 携带 `{ avatar: { storageKey } }` 消费
   * - Throttle 严：60s 内 10 次，防止刷 pending_uploads 表
   */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('avatar-presign')
  async avatarPresignEndpoint(
    @CurrentUser() user: AuthUser,
    @Body() dto: AvatarPresignDto,
  ): Promise<AvatarPresignResult> {
    return this.profileMediaPresign.presign(getCurrentUserId(user), dto, 'AVATAR');
  }

  /**
   * Profile banner reservation 端点 —— 与 avatar-presign 同构（同一 Throttle 配额语义：
   * 60s 内 10 次，防刷 pending_uploads 表），消费走 `PATCH auth/profile { bannerStorageKey }`。
   */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('banner-presign')
  async bannerPresignEndpoint(
    @CurrentUser() user: AuthUser,
    @Body() dto: BannerPresignDto,
  ): Promise<BannerPresignResult> {
    return this.profileMediaPresign.presign(getCurrentUserId(user), dto, 'BANNER');
  }
}
