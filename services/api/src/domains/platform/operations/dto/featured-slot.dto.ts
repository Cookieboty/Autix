import {
  ArrayMinSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { FeaturedSlotKind, ResourceType } from '../../prisma/generated';

/** 管理端新建运营位。position 省略时由 service 追加到末尾。 */
export class CreateFeaturedSlotDto {
  @IsString()
  @MinLength(1)
  placement!: string;

  @IsEnum(FeaturedSlotKind)
  kind!: FeaturedSlotKind;

  @IsOptional()
  @IsEnum(ResourceType)
  resourceType?: ResourceType | null;

  @IsOptional()
  @IsString()
  resourceId?: string | null;

  @IsOptional()
  @IsString()
  overrideTitle?: string | null;

  @IsOptional()
  @IsString()
  overrideDescription?: string | null;

  @IsOptional()
  @IsString()
  overrideCoverImage?: string | null;

  @IsOptional()
  @IsString()
  overrideCoverVideo?: string | null;

  @IsOptional()
  @IsString()
  overrideCtaText?: string | null;

  @IsOptional()
  @IsString()
  overrideCtaHref?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsDateString()
  startsAt?: string | null;

  @IsOptional()
  @IsDateString()
  endsAt?: string | null;
}

/**
 * 管理端更新运营位。不含 position —— 顺序调整走独立的 /reorder 接口，
 * 避免两条写路径同时触碰 `@@unique([placement, position])`。
 */
export class UpdateFeaturedSlotDto {
  @IsOptional()
  @IsEnum(FeaturedSlotKind)
  kind?: FeaturedSlotKind;

  @IsOptional()
  @IsEnum(ResourceType)
  resourceType?: ResourceType | null;

  @IsOptional()
  @IsString()
  resourceId?: string | null;

  @IsOptional()
  @IsString()
  overrideTitle?: string | null;

  @IsOptional()
  @IsString()
  overrideDescription?: string | null;

  @IsOptional()
  @IsString()
  overrideCoverImage?: string | null;

  @IsOptional()
  @IsString()
  overrideCoverVideo?: string | null;

  @IsOptional()
  @IsString()
  overrideCtaText?: string | null;

  @IsOptional()
  @IsString()
  overrideCtaHref?: string | null;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsDateString()
  startsAt?: string | null;

  @IsOptional()
  @IsDateString()
  endsAt?: string | null;
}

export class ReorderFeaturedSlotsDto {
  @IsString()
  @MinLength(1)
  placement!: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayMinSize(1)
  @IsString({ each: true })
  orderedIds!: string[];
}

/** 候选资源检索：仅 RESOURCE 类型的三张来源表可用（模板 / 广场作品）。 */
export class SearchCandidatesQueryDto {
  @IsIn(['IMAGE_TEMPLATE', 'VIDEO_TEMPLATE', 'GALLERY_POST'])
  resourceType!: 'IMAGE_TEMPLATE' | 'VIDEO_TEMPLATE' | 'GALLERY_POST';

  @IsOptional()
  @IsString()
  query?: string;
}
