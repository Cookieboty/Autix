import { IsString, MinLength, IsOptional, IsEmail, MaxLength, Matches } from 'class-validator';
import {
  PASSWORD_REGEX,
  PASSWORD_VALIDATION_MESSAGE,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
} from '@autix/domain';

export class LoginDto {
  @IsString()
  @MaxLength(64)
  username: string;

  // 登录只验证密码是否匹配，不做长度/复杂度限制 —
  // 这些规则只在注册（RegisterDto）时强制，避免限制了老用户重新登录
  @IsString()
  @MaxLength(128)
  password: string;

  @IsOptional()
  @IsString()
  deviceName?: string;
}

export class RefreshDto {
  @IsString()
  refreshToken: string;
}

export class RegisterDto {
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  username: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  @Matches(PASSWORD_REGEX, { message: PASSWORD_VALIDATION_MESSAGE })
  password: string;

  @IsString()
  systemCode: string;

  @IsOptional()
  @IsString()
  inviteCode?: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  email: string;
}

export class ResetPasswordByTokenDto {
  @IsString()
  token: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  @Matches(PASSWORD_REGEX, { message: PASSWORD_VALIDATION_MESSAGE })
  newPassword: string;
}

export class ActivateAccountDto {
  @IsString()
  token: string;
}

export class ResendActivationDto {
  @IsEmail()
  email: string;
}

export class RequestEmailSupplementDto {
  @IsEmail()
  email: string;
}

export class RequestEmailChangeDto {
  @IsEmail()
  email: string;

  @IsString()
  proof: string;
}

export class ConfirmEmailChangeDto {
  @IsString()
  token: string;
}

export class SetOrChangePasswordDto {
  // step-up proof（一次性 JWT）
  @IsString()
  proof: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  @Matches(PASSWORD_REGEX, { message: PASSWORD_VALIDATION_MESSAGE })
  newPassword: string;
}

export class DeleteAccountDto {
  // step-up proof（一次性 JWT，purpose='delete-account'）
  @IsString()
  proof: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  usernameConfirmation: string;
}
