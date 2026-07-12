import { IsOptional, IsString, IsUrl, MaxLength, ValidateIf, registerDecorator, ValidationOptions } from 'class-validator';
import { OWN_PROFILE_LIMITS, type UpdateOwnProfileInput } from '@autix/domain';

/**
 * T16: `avatar` 与 `avatarStorageKey` 互斥校验器。
 * 两个字段都是可选，但同时出现视为不合法（前端不应该"既贴外链又消费 reservation"）。
 */
function AvatarExclusive(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'AvatarExclusive',
      target: object.constructor,
      propertyName,
      options: {
        message: 'avatar 与 avatarStorageKey 不能同时提交',
        ...validationOptions,
      },
      validator: {
        validate(_value: unknown, args) {
          const obj = (args?.object ?? {}) as UpdateOwnProfileDto;
          const hasAvatar = Object.prototype.hasOwnProperty.call(obj, 'avatar') && obj.avatar !== undefined;
          const hasKey = Object.prototype.hasOwnProperty.call(obj, 'avatarStorageKey') && obj.avatarStorageKey !== undefined;
          return !(hasAvatar && hasKey);
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
  @IsString({ message: 'nickname 必须为字符串或 null' })
  @MaxLength(OWN_PROFILE_LIMITS.nicknameMaxLength, {
    message: `nickname 长度不能超过 ${OWN_PROFILE_LIMITS.nicknameMaxLength}`,
  })
  nickname?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString({ message: 'description 必须为字符串或 null' })
  @MaxLength(OWN_PROFILE_LIMITS.descriptionMaxLength, {
    message: `description 长度不能超过 ${OWN_PROFILE_LIMITS.descriptionMaxLength}`,
  })
  description?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString({ message: 'avatar 必须为字符串或 null' })
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true }, { message: 'avatar 必须是有效的 HTTP(S) URL' })
  @MaxLength(OWN_PROFILE_LIMITS.avatarUrlMaxLength, {
    message: `avatar URL 长度不能超过 ${OWN_PROFILE_LIMITS.avatarUrlMaxLength}`,
  })
  @AvatarExclusive()
  avatar?: string | null;

  @IsOptional()
  @IsString({ message: 'avatarStorageKey 必须为字符串' })
  @MaxLength(512, { message: 'avatarStorageKey 长度不能超过 512' })
  avatarStorageKey?: string;
}
