import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  UsePipes,
  ValidationPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../identity/auth/jwt-auth.guard';
import { CurrentUser, getCurrentUserId } from '../../identity/auth/decorators/current-user.decorator';
import { AdminGuard } from '../../identity/auth/admin.guard';
import { ModelConfigService, toClientModelConfig } from './model-config.service';
import { IsString, IsOptional, IsBoolean, IsInt, IsEnum, IsObject, Min } from 'class-validator';
import { ModelType, ModelVisibility } from '../../platform/prisma/generated';
import { Public } from '../../identity/auth/decorators/public.decorator';
import type { AuthUser } from '@autix/domain';
import type { ParamsSchema, PricingSchema } from '@autix/domain/pricing';
import type { LocalizedText } from '@autix/domain/model';

class CreateModelConfigDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsString()
  model!: string;

  @IsOptional()
  @IsEnum(ModelType)
  type?: ModelType;

  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @IsOptional()
  @IsString()
  baseUrl?: string;

  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsEnum(ModelVisibility)
  visibility?: ModelVisibility;

  @IsOptional()
  @IsString({ each: true })
  capabilities?: string[];

  @IsOptional()
  @IsString({ each: true })
  allowedMembershipLevelIds?: string[];

  // Nested JSON structures — the fine-grained control-contract / pricing-term
  // rules are enforced by validateParamsSchema/validatePricingSchema in the
  // service layer. @IsObject() here only rejects wholesale-wrong-typed input
  // (e.g. a string or array) before it reaches the service.
  @IsObject()
  paramsSchema!: ParamsSchema;

  @IsObject()
  pricingSchema!: PricingSchema;

  @IsOptional()
  @IsObject()
  description?: LocalizedText;
}

class UpdateModelConfigDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsEnum(ModelType)
  type?: ModelType;

  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @IsOptional()
  @IsString()
  baseUrl?: string;

  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsEnum(ModelVisibility)
  visibility?: ModelVisibility;

  @IsOptional()
  @IsString({ each: true })
  capabilities?: string[];

  @IsOptional()
  @IsString({ each: true })
  allowedMembershipLevelIds?: string[];

  @IsOptional()
  @IsObject()
  paramsSchema?: ParamsSchema;

  @IsOptional()
  @IsObject()
  pricingSchema?: PricingSchema;

  @IsOptional()
  @IsObject()
  description?: LocalizedText;
}

@UseGuards(JwtAuthGuard)
@Controller('models')
export class ModelConfigController {
  constructor(private readonly modelConfigService: ModelConfigService) {}

  // 面向用户的三个端点一律走白名单 DTO —— 未列出的字段（含将来新增的未知字段）
  // 一律不返回。service 方法本身返回的是完整记录：它们同时被 image-generation-flow /
  // video / orchestrator 等内部服务调用，那些调用方需要 apiKey / baseUrl 才能调上游。
  // 脱敏因此只能做在 HTTP 边界上，不能做进 service。

  @Get('available')
  async findAvailable(@CurrentUser() user: AuthUser) {
    const userId = getCurrentUserId(user);
    const models = await this.modelConfigService.findAvailableGeneralModels(userId);
    return models.map(toClientModelConfig);
  }

  @Public()
  @Get('public/available')
  async findPublicAvailable() {
    const models = await this.modelConfigService.findAvailablePublicModels();
    return models.map(toClientModelConfig);
  }

  @Get('default/:type')
  async findDefault(@CurrentUser() user: AuthUser, @Param('type') type: ModelType) {
    const userId = getCurrentUserId(user);
    const model = await this.modelConfigService.findDefaultByTypeForUser(type, userId);
    return model ? toClientModelConfig(model) : null;
  }

  @Get('system')
  @UseGuards(AdminGuard)
  async findSystemModels() {
    return this.modelConfigService.findSystemModels();
  }

  @Post('system')
  @UseGuards(AdminGuard)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async createSystemModel(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateModelConfigDto,
  ) {
    const userId = getCurrentUserId(user);
    return this.modelConfigService.createSystemModel(dto, userId);
  }

  @Put('system/:id')
  @UseGuards(AdminGuard)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async updateSystemModel(@Param('id') id: string, @Body() dto: UpdateModelConfigDto) {
    return this.modelConfigService.updateSystemModel(id, dto);
  }

  @Delete('system/:id')
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeSystemModel(@Param('id') id: string) {
    await this.modelConfigService.deleteSystemModel(id);
  }
}
