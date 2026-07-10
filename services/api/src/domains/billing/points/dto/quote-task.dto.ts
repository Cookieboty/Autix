import { IsObject, IsOptional, IsString } from 'class-validator';

export class QuoteTaskDto {
  @IsOptional()
  @IsString()
  modelConfigId?: string;

  @IsObject()
  params!: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  usage?: Record<string, unknown>;
}
