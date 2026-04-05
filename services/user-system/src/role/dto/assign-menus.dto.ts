import { IsArray, IsString } from 'class-validator';

export class AssignMenusDto {
  @IsArray()
  @IsString({ each: true })
  menuIds: string[];
}
