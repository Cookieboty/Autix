import { Injectable, HttpStatus } from '@nestjs/common';
import { I18nHttpException } from '../../platform/i18n/i18n-http.exception';
import type { AuthUser, PublicProfile } from '@autix/domain';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { GalleryService } from '../gallery/gallery.service';
import { presentPublicProfile } from './public-profile.presenter';

/**
 * `/@username` 公开个人页读模型：聚合 identity（用户基础字段）+ creation（gallery 统计/feed）。
 *
 * 放在 creation 域而非 identity 域：现有依赖方向是 creation → identity（gallery 已 import auth），
 * 反过来会形成层级倒置。用户基础字段直接读 Prisma —— 与 gallery.repository 读 author.username/
 * avatar 是同一种做法（跨域读同一张 users 表，不反向依赖 UserService）。
 */
@Injectable()
export class PublicProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gallery: GalleryService,
  ) {}

  /** 按 username 解析并组装公开 profile。用户不存在或已注销 → 404（不泄漏存在性差异）。 */
  async getByUsername(username: string): Promise<PublicProfile> {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        status: true,
        nickname: true,
        realName: true,
        avatar: true,
        bannerImage: true,
        headline: true,
        description: true,
        location: true,
        socialX: true,
        socialInstagram: true,
        socialYoutube: true,
        socialTiktok: true,
        createdAt: true,
      },
    });
    // 已注销用户的 username 会被改写成 deleted_<id>，正常查不到；这里再兜一层 status。
    if (!user || user.status === 'DELETED') {
      throw new I18nHttpException(HttpStatus.NOT_FOUND, 'creation.profile.user_not_found');
    }

    const stats = await this.gallery.getAuthorStats(user.id);
    return presentPublicProfile(user, stats);
  }

  /** 个人页 Generations feed：委托 gallery service 的作者 feed（PUBLISHED，image+video 混排）。 */
  async getGenerations(
    username: string,
    cursor: string | undefined,
    limit: number,
    viewer?: AuthUser,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: { id: true, status: true },
    });
    if (!user || user.status === 'DELETED') {
      throw new I18nHttpException(HttpStatus.NOT_FOUND, 'creation.profile.user_not_found');
    }
    return this.gallery.listAuthorFeed(user.id, cursor, limit, viewer);
  }
}
