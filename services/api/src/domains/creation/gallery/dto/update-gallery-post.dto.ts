import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { GallerySource } from '../../../platform/prisma/generated';

/**
 * 编辑投稿/草稿（PATCH /gallery/drafts/:id、PATCH /gallery/:id）。
 * 全部字段可选；kind 与 status 不允许通过本 DTO 修改。
 */
export class UpdateGalleryPostDto {
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
  @IsIn(['USER_UPLOAD', 'FROM_GENERATION', 'FROM_TEMPLATE', 'ADMIN_CURATED'])
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
