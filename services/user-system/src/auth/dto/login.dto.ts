import { IsString, MinLength, IsOptional, IsEmail, MaxLength, Matches } from 'class-validator';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;
const PASSWORD_MESSAGE = '密码必须包含大写字母、小写字母和数字';

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
  @MinLength(8)
  @MaxLength(128)
  @Matches(PASSWORD_REGEX, { message: PASSWORD_MESSAGE })
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
  @MinLength(8)
  @MaxLength(128)
  @Matches(PASSWORD_REGEX, { message: PASSWORD_MESSAGE })
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
