import { IsString } from 'class-validator';

export class SwitchSystemDto {
  @IsString()
  systemId: string;
}
