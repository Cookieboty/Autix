import { IsString, IsNotEmpty } from 'class-validator';

export class UpdateLanguageDto {
  @IsString()
  @IsNotEmpty()
  language: string;
}
