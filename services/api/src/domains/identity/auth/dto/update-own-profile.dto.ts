import { IsOptional, IsString, IsUrl, MaxLength, ValidateIf, registerDecorator, ValidationOptions } from 'class-validator';
import { OWN_PROFILE_LIMITS, type UpdateOwnProfileInput } from '@autix/domain';

/**
 * T16: 「外链 URL 字段」与「reservation key 字段」互斥校验器。
 * 两个字段都是可选，但同时出现视为不合法（前端不应该"既贴外链又消费 reservation"）。
 * 头像与 banner 各用一次，故参数化字段名。
 */
function UrlKeyExclusive(urlField: string, keyField: string, validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'UrlKeyExclusive',
      target: object.constructor,
      propertyName,
      options: {
        ...validationOptions,
      },
      validator: {
        validate(_value: unknown, args) {
          const obj = (args?.object ?? {}) as Record<string, unknown>;
          const has = (f: string) =>
            Object.prototype.hasOwnProperty.call(obj, f) && obj[f] !== undefined;
          return !(has(urlField) && has(keyField));
        },
      },
    });
  };
}

/**
 * T11: `PATCH auth/profile` DTO —— 白名单字段。
 *
 * 关键设计：
 * - **只声明** `nickname / description / avatar / avatarStorageKey`；class-validator 的 `whitelist:true`
 *   全局配置会自动剥离前端多塞的 `email / status / password` 等——
 *   这是防止越权更新的第一道防线（第二道是 service 层重构造 update data 白名单）。
 * - 每字段都是 `@IsOptional()`：允许仅提交部分字段（partial update）。
 * - `null` 视为"清空"（前端明确要清除昵称/简介/头像），因此使用 `@ValidateIf` 跳过 null 的字符串校验。
 * - 长度上限统一自 [OWN_PROFILE_LIMITS](file:///Users/botycookie/test/llm/packages/domain/src/auth/index.ts) domain 常量，前后端共用。
 * - T16: `avatarStorageKey` 消费 reservation 走 [AvatarPresignService](file:///Users/botycookie/test/llm/services/api/src/domains/platform/storage/avatar-presign.service.ts) 发出的对象 key；
 *   与 `avatar` 互斥（`AvatarExclusive` 装饰器校验）。
 */
export class UpdateOwnProfileDto implements UpdateOwnProfileInput {
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(OWN_PROFILE_LIMITS.nicknameMaxLength)
  nickname?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(OWN_PROFILE_LIMITS.descriptionMaxLength)
  description?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(OWN_PROFILE_LIMITS.headlineMaxLength)
  headline?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(OWN_PROFILE_LIMITS.locationMaxLength)
  location?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(OWN_PROFILE_LIMITS.socialMaxLength)
  socialX?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(OWN_PROFILE_LIMITS.socialMaxLength)
  socialInstagram?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(OWN_PROFILE_LIMITS.socialMaxLength)
  socialYoutube?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(OWN_PROFILE_LIMITS.socialMaxLength)
  socialTiktok?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(OWN_PROFILE_LIMITS.avatarUrlMaxLength)
  @UrlKeyExclusive('avatar', 'avatarStorageKey')
  avatar?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  avatarStorageKey?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(OWN_PROFILE_LIMITS.bannerUrlMaxLength)
  @UrlKeyExclusive('bannerImage', 'bannerStorageKey')
  bannerImage?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  bannerStorageKey?: string;
}
