import { IsString, MaxLength, MinLength } from 'class-validator';

export class RejectGalleryPostDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}
