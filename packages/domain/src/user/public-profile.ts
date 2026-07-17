/**
 * `/@username` 公开个人页的契约。
 *
 * 这是**匿名可读**的响应，字段白名单是安全边界而非展示偏好：email / phone / realName /
 * status / isSuperAdmin 等一律不出现在这里。新增字段前先问「未登录访客看到它可以吗」。
 *
 * 已注销用户（status=DELETED）不返回 profile —— 端点直接 404，与 gallery presentAuthor
 * 的隐私铁律一致（绝不回传 deleted_<id> 型 username 或旧头像）。
 */
export interface PublicProfileSocials {
  x: string | null;
  instagram: string | null;
  youtube: string | null;
  tiktok: string | null;
}

/**
 * 左侧统计。**刻意不含 followers / following** —— 本仓库尚无关注系统，
 * 与其回传恒为 0 的假字段，不如等真做了再加（前端也就不会先长出依赖）。
 */
export interface PublicProfileStats {
  /** 该用户全部已发布作品的浏览量之和（resource_metrics.viewCount）。 */
  viewCount: number;
  /** 同上的点赞数之和（resource_metrics.likeCount）。 */
  likeCount: number;
  /** 已发布作品数 —— 即 Generations 页签的条目总数。 */
  generationCount: number;
}

export interface PublicProfile {
  userId: string;
  /** 虚荣链接里的那个 handle：`/@<username>`。 */
  username: string;
  /** nickname ?? realName ?? username，与 gallery 作者展示名同一套回退。 */
  displayName: string;
  avatar: string | null;
  bannerImage: string | null;
  headline: string | null;
  /** 对应 `User.description`（前端叫 Bio）。 */
  bio: string | null;
  location: string | null;
  socials: PublicProfileSocials;
  stats: PublicProfileStats;
  /** ISO 8601 */
  joinedAt: string;
}
