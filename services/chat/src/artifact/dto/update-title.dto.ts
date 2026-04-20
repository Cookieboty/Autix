import { IsString } from 'class-validator';

export class UpdateTitleDto {
  @IsString()
  title!: string;
}
