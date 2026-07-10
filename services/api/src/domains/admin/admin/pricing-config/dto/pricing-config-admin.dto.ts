import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

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

/** Mirrors TaskPreset['category'] in @autix/domain/pricing (packages/domain/src/pricing/presets.ts). */
export const TASK_CATEGORIES = ['chat', 'image', 'video', 'prompt'] as const;
export type TaskCategoryDto = (typeof TASK_CATEGORIES)[number];

export class CreateTaskDefinitionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  taskType!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsIn(TASK_CATEGORIES)
  category!: TaskCategoryDto;

  /** Real money: undefined leaves the field untouched-by-this-request, null clears it, an object is validated by validatePricingSchema in the service. */
  @IsOptional()
  @IsObject()
  fixedCostSchema?: Record<string, unknown> | null;
}

export class UpdateTaskDefinitionDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsIn(TASK_CATEGORIES)
  category?: TaskCategoryDto;

  @IsOptional()
  @IsObject()
  fixedCostSchema?: Record<string, unknown> | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  sort?: number;
}

export class CreateTaskModelBindingDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  taskType!: string;

  @IsString()
  @MinLength(1)
  modelConfigId!: string;

  @IsOptional()
  @IsNumber()
  multiplier?: number;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateTaskModelBindingDto {
  @IsOptional()
  @IsNumber()
  multiplier?: number;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  sort?: number;
}

export class CreateDiscountDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsNumber()
  factor!: number;

  @IsObject()
  scope!: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  stackable?: boolean;

  @IsOptional()
  @IsInt()
  priority?: number;

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string | null;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string | null;
}

export class UpdateDiscountDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsNumber()
  factor?: number;

  @IsOptional()
  @IsObject()
  scope?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  stackable?: boolean;

  @IsOptional()
  @IsInt()
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string | null;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string | null;
}
