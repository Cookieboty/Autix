import { IsBoolean } from 'class-validator';

export class UpdateAutoPublishDto {
  @IsBoolean()
  autoPublish: boolean;
}
