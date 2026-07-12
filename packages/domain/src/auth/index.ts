import type { Menu, SystemInfo } from '../rbac';

export interface JwtPayload {
  sub: string;
  username: string;
  sessionId: string;
  language?: string;
  iat?: number;
  exp?: number;
}

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  emailVerified?: boolean;
  pendingEmail?: string | null;
  realName?: string | null;
  nickname?: string | null;
  description?: string | null;
  avatar?: string | null;
  language?: string | null;
  isSuperAdmin: boolean;
  status: string;
  hasPassword?: boolean;
  permissions: string[];
  roles: string[];
  currentSystemId?: string;
  sessionId?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthProfileFeatures {
  nicknameEditable?: boolean;
  descriptionEditable?: boolean;
  emailChange?: boolean;
  passwordSet?: boolean;
  accountDeletion?: boolean;
}

/**
 * T15: 用户 profile 端点的统一响应契约。
 * - `PATCH auth/profile` / `POST auth/password` / `GET auth/profile` 均返回该形状；
 * - 前端 `useAuthStore.setUser` 以此为唯一 shape，避免 login/refresh 之外的场景重复类型；
 * - **不包含** `avatarStorageKey`（服务端内部字段，后端 helper 显式剥离），从类型上禁止前端消费。
 * - T15.5: `menus` / `systems` 收紧到强类型；
 * - T15.9: 直接引 rbac 的 `Menu / SystemInfo`（rbac 已改为依赖 `RbacSubject` 而不再反向依赖 `AuthUser`，
 *   打破了 auth↔rbac 循环）。之前 T15.5 引入的 `AuthProfileMenu / AuthProfileSystem` 内联重复
 *   本轮删除，避免 domain 内出现两份等价定义。
 */
export interface AuthProfile extends AuthUser {
  systems?: SystemInfo[];
  menus?: Menu[];
  features?: AuthProfileFeatures;
}

/**
 * T11: `PATCH auth/profile` 请求体白名单契约。
 *
 * 只允许自助修改这几个字段：
 * - `nickname`：显示名，非唯一；`null` 表示清空
 * - `description`：个人简介；`null` 表示清空
 * - `avatar`：**外链头像 URL**（旧路径，允许贴 gravatar 等）；`null` 表示清空
 * - `avatarStorageKey`（T16 新增）：**内部头像 reservation key**，来自 `POST /storage/avatar-presign`
 *   的返回值。后端事务内消费 pending_upload 后会把 `user.avatar=publicUrl, user.avatarStorageKey=key`
 *   一起写入；同时 `avatar` 与 `avatarStorageKey` **不允许同时**出现在同一次请求里（DTO 校验）。
 *
 * **明确禁止**（服务端 DTO 白名单会剥离）：
 * - `email / pendingEmail / emailVerified`：走 `POST auth/email/change` + confirm
 * - `password / hasPassword`：走 `POST auth/password`
 * - `status / roles / permissions / isSuperAdmin`：admin 独占
 * - `language`：走 `PATCH users/me/language`
 * - `realName / username`：非自助字段
 */
export interface UpdateOwnProfileInput {
  nickname?: string | null;
  description?: string | null;
  avatar?: string | null;
  /**
   * T16: 头像 reservation 消费 key。与 `avatar` 互斥；提供该字段时后端会：
   * 1. 查 pending_uploads WHERE storageKey=key AND ownerUserId=当前用户 AND status=PENDING AND expiresAt>now
   * 2. 未命中则 400
   * 3. 命中则事务内：置 CONSUMED → 更新 user.avatar=publicUrl + avatarStorageKey=key
   *    → 事务后 enqueue storage_cleanup_tasks(reason=AVATAR_REPLACED) 删旧 key
   */
  avatarStorageKey?: string;
}

/** T11: 白名单字段的长度上限（domain 常量，服务端和前端共用校验规则） */
export const OWN_PROFILE_LIMITS = {
  nicknameMaxLength: 32,
  descriptionMaxLength: 500,
  avatarUrlMaxLength: 2048,
} as const;

/**
 * T16: 头像上传实体路径。
 *
 * 设计模式：**reservation-then-consume**
 * 1. 前端调 `POST /storage/avatar-presign` 拿到 `{ uploadUrl, storageKey, publicUrl, expiresAt }`
 *    —— 服务端事务内 INSERT `pending_uploads(purpose=AVATAR, status=PENDING, expiresAt=+10min)`
 * 2. 前端 `PUT uploadUrl` 直传到 R2（不经过后端）
 * 3. 前端调 `PATCH auth/profile` 提交 `{ avatar: { storageKey } }` 消费 reservation
 *    —— 服务端事务内：查 pending_upload 归属当前用户 & 未过期 & 状态 PENDING → 置 CONSUMED →
 *      更新 `user.avatar=publicUrl, user.avatarStorageKey=storageKey` → 若旧 avatarStorageKey
 *      存在，enqueue storage_cleanup_tasks(reason=AVATAR_REPLACED, key=oldKey)
 * 4. 未在 expiresAt 前消费的 reservation 由 storage-cleanup.cron 扫描：
 *    `status=PENDING AND expiresAt<now` → DeleteObject → status=CONSUMED（沿用现有 status enum）
 *    并 enqueue cleanup task with reason=PENDING_UPLOAD_EXPIRED
 *
 * 兼容旧行为：`UpdateOwnProfileInput.avatar` 保留 string|null（外链 URL 直填），
 * 新走 reservation 路径时前端提交 `avatarStorageKey: 'xxx'`（独立字段而非 union，
 * 因为 union 会破坏 T13 前端旧调用点；独立字段也让 DTO 校验更清晰）。
 */
export interface AvatarPresignInput {
  /** 文件名，仅用于提取扩展名 */
  fileName: string;
  /** MIME，必须在 image/* 白名单内 */
  contentType: string;
  /** 精确字节数；头像预签名会把 Content-Length 绑定进签名 */
  sizeBytes: number;
}

export interface AvatarPresignResult {
  /** R2 预签名 PUT URL（10min 有效） */
  uploadUrl: string;
  /** 对象 key，前端提交 PATCH profile 时透传作 `avatar: { storageKey }` */
  storageKey: string;
  /** CDN 公开 URL —— 供上传成功后本地立即预览 */
  publicUrl: string;
  /** ISO 8601，与 pending_upload.expiresAt 一致 */
  expiresAt: string;
}

/** T16: 头像上传约束（domain 常量，与 R2 presign safe list 对齐） */
export const AVATAR_UPLOAD_LIMITS = {
  /** reservation 有效期（秒），与 pending_uploads.expiresAt 计算一致 */
  reservationTtlSeconds: 600,
  /** 单次上传体积上限（bytes），前后端各自校验；后端最终以 R2 policy 为准 */
  maxSizeBytes: 5 * 1024 * 1024,
  /** 允许的 MIME —— image/svg+xml 被排除（存储型 XSS 风险） */
  allowedContentTypes: [
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'image/gif',
    'image/avif',
  ] as const,
} as const;

export type StepUpPurpose =
  | 'change-password'
  | 'set-password'
  | 'change-email'
  | 'delete-account'
  | 'unlink-provider';

export const ALL_STEP_UP_PURPOSES: readonly StepUpPurpose[] = [
  'change-password',
  'set-password',
  'change-email',
  'delete-account',
  'unlink-provider',
] as const;

export type SocialLoginFlow = 'LOGIN' | 'LINK' | 'REAUTH';

export const ALL_SOCIAL_LOGIN_FLOWS: readonly SocialLoginFlow[] = [
  'LOGIN',
  'LINK',
  'REAUTH',
] as const;

// 密码策略统一落位到 ./password-policy（domain 单一事实源）；此处 re-export 保持向后兼容旧 import 路径。
export {
  PASSWORD_REGEX,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_VALIDATION_MESSAGE,
  PASSWORD_LENGTH_MESSAGE,
} from './password-policy';

export type OtpChannel = 'email';

export interface StepUpProofSubmission {
  proof: string;
  purpose: StepUpPurpose;
}

export type StartStepUpResult =
  | {
    kind: 'redirect';
    provider: string;
    authorizeUrl: string;
    state: string;
    expiresAt: string;
  }
  | {
    kind: 'otp';
    channel: OtpChannel;
    maskedTarget: string;
    requestId: string;
    resendCooldownSeconds: number;
    expiresAt: string;
  }
  | {
    kind: 'unsupported';
    reason: 'PROVIDER_REAUTH_UNSUPPORTED' | 'CONTACT_SUPPORT';
  };

export interface StepUpAuthorizeInput {
  purpose: StepUpPurpose;
  redirectUri?: string;
  clientType?: 'web' | 'desktop';
  provider?: string;
  preferEmailOtp?: boolean;
}

export interface StepUpOtpRequestInput {
  purpose: StepUpPurpose;
}

export interface StepUpOtpVerifyInput {
  purpose: StepUpPurpose;
  requestId: string;
  code: string;
}
