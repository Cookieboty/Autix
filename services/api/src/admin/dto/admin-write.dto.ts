// P1-3: AdminController 写操作 DTO 集中定义。
// 目标：
//   1. 拦截显式非法配置（如负数 baseCost / 负数月数 / 0 积分包等）；
//   2. 借助全局 ValidationPipe(whitelist) 去除多余字段，避免管理员误传未授权字段；
//   3. 后续如需扩展（i18n / 软删 / 校验范围）可在此集中处理。

import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// 会员等级与套餐相关 ──────────────────────────────────────────────

export class UpsertMembershipLevelDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  name!: string;

  @IsInt()
  @Min(0)
  level!: number;

  @IsInt()
  @Min(0)
  sort!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  pointsPerMonth?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsOptional()
  @IsObject()
  features?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpsertMembershipPlanDto {
  @IsString()
  @MinLength(1)
  levelId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  name!: string;

  @IsInt()
  @Min(1)
  @Max(120)
  durationMonths!: number;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  originalPrice?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  sort?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// 积分包与任务积分 ──────────────────────────────────────────────

export class UpsertPointsPackageDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  code?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsInt()
  @IsPositive()
  points!: number;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  bonusPoints?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  sort?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  validityDays?: number;

  @IsOptional()
  @IsObject()
  usageScope?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  showCommercialLicense?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// 生成定价规则 ────────────────────────────────────────────────────

export class UpsertPricingRuleDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  taskType!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  name!: string;

  @IsOptional() @IsString() modelProvider?: string;
  @IsOptional() @IsString() modelName?: string;
  @IsOptional() @IsString() quality?: string;
  @IsOptional() @IsString() resolution?: string;
  @IsOptional() @IsString() modelTier?: string;

  // P1-3: 关键经济字段一律禁止负数
  @IsInt()
  @Min(0)
  baseCost!: number;

  @IsOptional() @IsString() baseUnit?: string;

  @IsOptional() @IsInt() @Min(0) fixedExtraCost?: number;
  @IsOptional() @IsNumber() @Min(0) inputTokenCostPerK?: number;
  @IsOptional() @IsNumber() @Min(0) outputTokenCostPerK?: number;
  @IsOptional() @IsNumber() @Min(0) contextTokenCostPerK?: number;
  @IsOptional() @IsNumber() @Min(0) toolCallCost?: number;
  @IsOptional() @IsNumber() @Min(0) batchUnitCost?: number;
  @IsOptional() @IsNumber() @Min(0) referenceImageFixedCost?: number;

  // 倍率允许 >= 0（0 表示禁用），但禁止负数
  @IsOptional() @IsNumber() @Min(0) reasoningMultiplier?: number;
  @IsOptional() @IsNumber() @Min(0) referenceImageMultiplier?: number;
  @IsOptional() @IsNumber() @Min(0) videoInputMultiplier?: number;
  @IsOptional() @IsNumber() @Min(0) audioInputMultiplier?: number;
  @IsOptional() @IsNumber() @Min(0) priorityMultiplier?: number;

  @IsOptional() @IsInt() @Min(0) minDurationSeconds?: number;
  @IsOptional() @IsInt() @Min(0) maxDurationSeconds?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(32)
  allowedMembershipLevels?: number[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(32)
  disallowedGrantTypes?: string[];

  @IsOptional() @IsObject() refundPolicy?: Record<string, unknown>;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

// P3-3: pricing-rules 预览输入校验，避免 preview 接口接受任意字段污染日志/匹配
export class PreviewPricingRuleInputDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  taskType!: string;

  @IsOptional() @IsString() modelProvider?: string;
  @IsOptional() @IsString() modelName?: string;
  @IsOptional() @IsString() quality?: string;
  @IsOptional() @IsString() resolution?: string;
  @IsOptional() @IsString() modelTier?: string;

  @IsOptional() @IsInt() @Min(0) quantity?: number;
  @IsOptional() @IsNumber() @Min(0) seconds?: number;
  @IsOptional() @IsInt() @Min(0) inputTokens?: number;
  @IsOptional() @IsInt() @Min(0) outputTokens?: number;
  @IsOptional() @IsInt() @Min(0) contextTokens?: number;
  @IsOptional() @IsInt() @Min(0) toolCalls?: number;
  @IsOptional() @IsInt() @Min(0) batchCount?: number;
  @IsOptional() @IsInt() @Min(0) referenceImages?: number;
  @IsOptional() @IsBoolean() hasVideoInput?: boolean;
  @IsOptional() @IsBoolean() hasAudioInput?: boolean;
  @IsOptional() @IsBoolean() priority?: boolean;

  @IsOptional() @IsInt() @Min(0) membershipLevel?: number;
  @IsOptional() @IsString() grantType?: string;
}

// 订单 ──────────────────────────────────────────────────────────

export class FulfillOrderDto {
  @IsOptional() @IsString() @MaxLength(128) externalPaymentId?: string;
  @IsOptional() amount?: string | number;
  @IsOptional() @IsString() @MaxLength(8) currency?: string;
  @IsOptional() @IsString() @MaxLength(255) remark?: string;
}

export class RefundOrderDto {
  @IsOptional() @IsString() @MaxLength(128) externalRefundId?: string;
  @IsOptional() amount?: string | number;
  @IsOptional() @IsString() @MaxLength(8) currency?: string;
  @IsOptional() @IsBoolean() reclaimPoints?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxPointsToReclaim?: number;

  @IsOptional() @IsString() @MaxLength(255) reason?: string;
  @IsOptional() @IsString() @MaxLength(255) remark?: string;
}

// 用户管理：授予会员 / 授予积分 ──────────────────────────────────

export class ApproveUserDto {
  @IsOptional() @IsString() @MaxLength(255) note?: string;
}

export class GrantMembershipDto {
  @IsString()
  @MinLength(1)
  levelId!: string;

  // P1-3: 必须为正整数，禁止 0 / 负数 / 小数
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(120)
  months?: number;
}

export class GrantPointsDto {
  @IsOptional()
  @IsInt()
  @IsPositive()
  points?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  remark?: string;

  @IsOptional()
  @IsString()
  packageId?: string;
}
