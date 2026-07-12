import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { GalleryKind, GallerySource } from '../../../platform/prisma/generated';

/**
 * 草稿创建（POST /gallery/drafts）。草稿阶段字段可不完整——
 * 提交时（POST /gallery/:id/submit）才用 assertSource 强校验来源组合。
 */
export class CreateGalleryDraftDto {
  @IsEnum(GalleryKind)
  kind!: GalleryKind;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  category?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  coverImage?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mediaUrls?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(20)
  aspectRatio?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(24 * 60 * 60)
  durationSec?: number;

  @IsOptional()
  @IsIn(['USER_UPLOAD', 'FROM_GENERATION', 'FROM_TEMPLATE'])
  sourceType?: GallerySource;

  @IsOptional()
  @IsString()
  imageTemplateId?: string;

  @IsOptional()
  @IsString()
  videoTemplateId?: string;

  @IsOptional()
  @IsString()
  imageGenerationId?: string;

  @IsOptional()
  @IsString()
  videoGenerationId?: string;
}
