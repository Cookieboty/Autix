import {
  Controller,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../identity/auth/jwt-auth.guard';
import { CurrentUser, getCurrentUserId } from '../../identity/auth/decorators/current-user.decorator';
import type { AuthUser } from '@autix/domain';
import { CloudflareR2Service } from './cloudflare-r2.service';

@UseGuards(JwtAuthGuard)
@Controller('storage')
export class StorageController {
  constructor(private readonly r2: CloudflareR2Service) {}

  @Post('presign')
  async presign(
    @CurrentUser() user: AuthUser,
    @Body() body: { fileName: string; contentType: string; folder?: string },
  ) {
    const userId = getCurrentUserId(user);
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
}
