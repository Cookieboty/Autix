import { IsOptional, IsString } from 'class-validator';

export class ProcessRegistrationDto {
  @IsOptional()
  @IsString()
  note?: string;
}
