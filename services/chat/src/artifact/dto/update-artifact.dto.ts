import { IsString, IsOptional } from 'class-validator';

export class UpdateArtifactDto {
  @IsString()
  content!: string;

  @IsOptional()
  @IsString()
  changelog?: string;
}
