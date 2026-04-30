import { IsString, MinLength, IsOptional, IsEmail, MaxLength, Matches } from 'class-validator';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;
const PASSWORD_MESSAGE = '密码必须包含大写字母、小写字母和数字';

export class LoginDto {
  @IsString()
  @MaxLength(64)
  username: string;

  @IsString()
  @MinLength(8)
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
