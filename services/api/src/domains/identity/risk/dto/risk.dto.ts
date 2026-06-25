import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { RISK_LEVELS } from '../risk.service';

export class ListRiskUsersQueryDto {
  @IsOptional()
  @IsIn(RISK_LEVELS as unknown as string[])
  level?: string;

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  pageSize?: string;
}

export class SetRiskLevelDto {
  @IsIn(RISK_LEVELS as unknown as string[])
  level!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class RiskActionDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
