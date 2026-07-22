import {
  IsString,
  IsEmail,
  MinLength,
  MaxLength,
  Matches,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { UserStatus } from '@autix/database';
import {
  PASSWORD_REGEX,
  PASSWORD_VALIDATION_MESSAGE,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
} from '@autix/domain';
import { normalizeEmailTransform } from '../../auth/email-normalize';

export class CreateUserDto {
  @IsString()
  username: string;

  @IsEmail()
  @Transform(normalizeEmailTransform)
  email: string;

  @IsOptional()
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  @Matches(PASSWORD_REGEX, { message: PASSWORD_VALIDATION_MESSAGE })
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
