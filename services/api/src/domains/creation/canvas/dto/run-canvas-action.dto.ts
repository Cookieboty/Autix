import { IsArray, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import type { CanvasActionType } from '@autix/domain';

const ACTION_TYPES: CanvasActionType[] = [
  'image-generate',
  'image-edit',
  'video-from-selection',
  'storyboard-from-selection',
  'agent-chat',
  'export',
];

export class EstimateActionDto {
  @IsIn(ACTION_TYPES)
  actionType!: CanvasActionType;

  @IsArray()
  @IsString({ each: true })
  selectedNodeIds!: string[];

  @IsOptional()
  @IsString()
  modelConfigId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  count?: number;
}

export class ImageGenerateActionDto {
  @IsString()
  idempotencyKey!: string;

  @IsString()
  clientPlaceholderId!: string;

  @IsArray()
  @IsString({ each: true })
  selectedNodeIds!: string[];

  @IsString()
  modelConfigId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  count?: number;
}

/**
 * Chat-driven generation: a free-text prompt (+ optional reference image URLs
 * already on the canvas) produces one or more images. The frontend places the
 * returned images onto the Excalidraw scene and persists positions itself.
 */
export class ChatGenerateActionDto {
  @IsString()
  idempotencyKey!: string;

  @IsString()
  prompt!: string;

  @IsString()
  modelConfigId!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  referenceImageUrls?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  count?: number;
}
