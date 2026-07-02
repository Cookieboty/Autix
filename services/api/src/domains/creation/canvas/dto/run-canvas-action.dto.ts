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
