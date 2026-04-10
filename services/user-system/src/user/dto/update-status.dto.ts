import { IsEnum } from 'class-validator';
import { UserStatus } from '@autix/database';

export class UpdateStatusDto {
  @IsEnum(UserStatus)
  status: UserStatus;
}
