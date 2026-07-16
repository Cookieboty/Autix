import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export type GalleryBatchAction = 'approve' | 'reject' | 'hide' | 'remove';

export class BatchModerateGalleryDto {
  /** 上限 100：UI 一页只有 20 条，100 已经很宽松，同时挡住构造大 body 打爆连接池。 */
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  ids!: string[];

  @IsIn(['approve', 'reject', 'hide', 'remove'])
  action!: GalleryBatchAction;

  /** 仅 reject 需要，约束与单条 RejectGalleryPostDto 保持一致（1–500）。 */
  @ValidateIf((o: BatchModerateGalleryDto) => o.action === 'reject')
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason?: string;
}
