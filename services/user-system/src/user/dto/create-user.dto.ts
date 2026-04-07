import { IsString, IsEmail, MinLength, IsOptional, IsEnum } from 'class-validator';
import { UserStatus } from '@repo/database';

export class CreateUserDto {
  @IsString()
  username: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @IsOptional()
  @IsString()
  realName?: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @IsString()
  systemId?: string;

  @IsOptional()
  @IsString()
  roleCode?: string;
}
