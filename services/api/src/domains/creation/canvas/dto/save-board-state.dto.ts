import { IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';
import type { CanvasBoardState } from '@autix/domain';

export class SaveBoardStateDto {
  /** Canonical board state. Validated/normalized by domain helpers server-side. */
  @IsObject()
  state!: CanvasBoardState;

  /** True to cut a milestone snapshot instead of overwriting the working one. */
  @IsOptional()
  @IsBoolean()
  createSnapshot?: boolean;

  @IsOptional()
  @IsString()
  thumbnailStorageKey?: string;
}
