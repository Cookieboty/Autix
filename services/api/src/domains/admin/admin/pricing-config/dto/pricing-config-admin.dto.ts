import { IsObject, IsOptional } from 'class-validator';

export class UpdateModelSchemasDto {
  @IsObject()
  paramsSchema!: Record<string, unknown>;

  @IsObject()
  pricingSchema!: Record<string, unknown>;
}

export class UpdateModelDescriptionDto {
  @IsObject()
  description!: Record<string, unknown>;
}

export class DryRunPricingDto {
  @IsObject()
  paramsSchema!: Record<string, unknown>;

  @IsObject()
  pricingSchema!: Record<string, unknown>;

  @IsObject()
  sampleParams!: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  sampleUsage?: Record<string, unknown>;
}
