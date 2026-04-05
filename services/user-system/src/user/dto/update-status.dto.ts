import { IsEnum } from 'class-validator';
import { UserStatus } from '@repo/database';

export class UpdateStatusDto {
  @IsEnum(UserStatus)
  status: UserStatus;
}
