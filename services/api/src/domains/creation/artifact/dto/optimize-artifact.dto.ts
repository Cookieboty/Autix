import { IsString } from 'class-validator';

export class OptimizeArtifactDto {
  @IsString()
  instruction!: string;
}
