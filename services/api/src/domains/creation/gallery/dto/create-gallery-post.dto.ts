import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
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
 * 完整投稿（POST /gallery，先审后发 → 直接进 PENDING）。
 * 字段组合是否合法（USER_UPLOAD/FROM_GENERATION/FROM_TEMPLATE）
 * 由 service 层调用 assertSource 校验，本 DTO 只做类型/长度层面的基础校验。
 */
export class CreateGalleryPostDto {
  @IsEnum(GalleryKind)
  kind!: GalleryKind;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  category!: string;

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

  @IsIn(['USER_UPLOAD', 'FROM_GENERATION', 'FROM_TEMPLATE'])
  sourceType!: GallerySource;

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

  /**
   * FROM_GENERATION 投稿时，是否允许把生成时使用的参考图一并快照进画廊帖子的 referenceImage。
   * 未提供或非 true 时默认不快照（fail-closed；见 gallery.service.buildGenerationSnapshot）。
   */
  @IsOptional()
  @IsBoolean()
  allowPublicReference?: boolean;
}
