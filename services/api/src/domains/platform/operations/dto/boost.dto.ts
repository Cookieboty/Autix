import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { BoostReason, ResourceType } from '../../prisma/generated';

/** 管理端新建加热。resourceType/resourceId 来自路由参数，不在 body 里。 */
export class CreateBoostDto {
  @IsNumber()
  @Min(0)
  boostScore!: number;

  @IsOptional()
  @IsEnum(BoostReason)
  reason?: BoostReason;

  @IsOptional()
  @IsString()
  note?: string | null;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsDateString()
  endsAt!: string;
}

/** 管理端更新加热（不改 resourceType/resourceId；不改 isActive——撤销走独立的 revoke 接口）。 */
export class UpdateBoostDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  boostScore?: number;

  @IsOptional()
  @IsEnum(BoostReason)
  reason?: BoostReason;

  @IsOptional()
  @IsString()
  note?: string | null;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;
}

/** 管理端加热列表检索：按资源类型 + 资源 id 关键字过滤。 */
export class ListBoostsQueryDto {
  @IsOptional()
  @IsEnum(ResourceType)
  type?: ResourceType;

  @IsOptional()
  @IsString()
  query?: string;
}
