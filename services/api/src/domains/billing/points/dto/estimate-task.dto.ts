import { IsObject, IsOptional, IsString, MinLength } from 'class-validator';

export class EstimateTaskDto {
  @IsString()
  @MinLength(1)
  taskType!: string;

  @IsOptional()
  @IsString()
  modelConfigId?: string;

  @IsObject()
  params!: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  usage?: Record<string, unknown>;
}
