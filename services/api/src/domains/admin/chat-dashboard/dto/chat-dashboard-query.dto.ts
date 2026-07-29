import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import type {
  ChatDashboardPresetWindow,
  ChatDashboardWindow,
} from '@autix/domain/admin/chat-dashboard';

const WINDOWS: ChatDashboardWindow[] = [
  'today',
  'yesterday',
  'last7d',
  'custom',
];

export class ChatDashboardRangeQueryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  tz!: string;

  @IsString()
  @IsIn(WINDOWS)
  window!: ChatDashboardPresetWindow | 'custom';

  @Transform(({ obj, value }) => (obj.window === 'custom' ? value : undefined))
  @ValidateIf((dto: ChatDashboardRangeQueryDto) => dto.window === 'custom')
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @Transform(({ obj, value }) => (obj.window === 'custom' ? value : undefined))
  @ValidateIf((dto: ChatDashboardRangeQueryDto) => dto.window === 'custom')
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;
}
