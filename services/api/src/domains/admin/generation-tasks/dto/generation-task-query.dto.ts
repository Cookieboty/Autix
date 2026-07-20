import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import {
  GenerationErrorStage,
  GenerationKind,
  GenerationTaskStatus,
} from '../../../platform/prisma/generated';

/**
 * 列表 query。用 DTO 而非 admin.controller 里那种逐个 `@Query('x')` 裸字符串，
 * 是因为本端点筛选维度多（10 个），手写 normalize 容易漏校验。
 * 全局 ValidationPipe（main.ts:55，transform + whitelist）会自动生效。
 */
export class GenerationTaskListQueryDto {
  @IsOptional() @IsEnum(GenerationKind) kind?: GenerationKind;
  @IsOptional() @IsEnum(GenerationTaskStatus) status?: GenerationTaskStatus;
  @IsOptional() @IsEnum(GenerationErrorStage) errorStage?: GenerationErrorStage;

  @IsOptional() @IsString() userId?: string;
  @IsOptional() @IsString() model?: string;
  @IsOptional() @IsString() provider?: string;
  @IsOptional() @IsString() errorClass?: string;

  /** 按 generation_tasks.id 或 providerTaskId 精确查找。 */
  @IsOptional() @IsString() q?: string;

  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;

  /** 上限 100：这是给人看的后台列表，不是导出接口。 */
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : parseInt(value, 10)))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  /** 游标 = 上一页最后一行的 id。 */
  @IsOptional() @IsString() cursor?: string;
}
