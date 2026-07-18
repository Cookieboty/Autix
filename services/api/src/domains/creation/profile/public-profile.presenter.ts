import type { PublicProfile, PublicProfileStats } from '@autix/domain';
import { firstNonBlank } from '../gallery/gallery-author.presenter';

/**
 * `/@username` 公开个人页 presenter（纯函数，可脱离 Prisma / Nest 单测）。
 *
 * 输入刻意与 Prisma `User` 解耦，只收白名单里允许公开的字段 —— email / phone / realName /
 * isSuperAdmin 等根本不进这个函数的入参，从类型上杜绝越权外泄。
 *
 * 已注销用户由调用方（service）在此之前 404 拦截，不会走到这里。
 */
export interface PublicProfileUserSource {
  id: string;
  username: string;
  nickname: string | null;
  realName: string | null;
  avatar: string | null;
  bannerImage: string | null;
  headline: string | null;
  description: string | null;
  location: string | null;
  socialX: string | null;
  socialInstagram: string | null;
  socialYoutube: string | null;
  socialTiktok: string | null;
  createdAt: Date;
}

/** 空串/纯空白归一为 null，避免前端把 '' 当成"有值"渲染出空标签。 */
function blankToNull(value: string | null): string | null {
  return firstNonBlank(value);
}

export function presentPublicProfile(
  user: PublicProfileUserSource,
  stats: PublicProfileStats,
): PublicProfile {
  return {
    userId: user.id,
    username: user.username,
    // 与 gallery 作者展示名同一套回退：nickname → realName → username
    displayName: firstNonBlank(user.nickname, user.realName) ?? user.username,
    avatar: user.avatar,
    bannerImage: user.bannerImage,
    headline: blankToNull(user.headline),
    bio: blankToNull(user.description),
    location: blankToNull(user.location),
    socials: {
      x: blankToNull(user.socialX),
      instagram: blankToNull(user.socialInstagram),
      youtube: blankToNull(user.socialYoutube),
      tiktok: blankToNull(user.socialTiktok),
    },
    stats,
    joinedAt: user.createdAt.toISOString(),
  };
}
