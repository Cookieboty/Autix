import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { StepUpPurpose } from '@autix/domain';

export const STEP_UP_PURPOSES: StepUpPurpose[] = [
  'change-password',
  'set-password',
  'change-email',
  'delete-account',
  'unlink-provider',
];

export class StepUpAuthorizeDto {
  @IsString()
  @IsIn(STEP_UP_PURPOSES)
  purpose!: StepUpPurpose;

  // password 分支：用户重新输入当前密码
  @IsOptional()
  @IsString()
  @MaxLength(128)
  password?: string;

  // OAuth 分支占位（T8 补充 redirect）
  @IsOptional()
  @IsIn(['web', 'desktop'])
  clientType?: 'web' | 'desktop';

  @IsOptional()
  @IsString()
  redirectUri?: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsBoolean()
  preferEmailOtp?: boolean;
}

export class StepUpOtpRequestDto {
  @IsString()
  @IsIn(STEP_UP_PURPOSES)
  purpose!: StepUpPurpose;
}

export class StepUpOtpVerifyDto {
  @IsString()
  @IsIn(STEP_UP_PURPOSES)
  purpose!: StepUpPurpose;

  @IsString()
  requestId!: string;

  @IsString()
  @MinLength(4)
  @MaxLength(8)
  code!: string;
}
