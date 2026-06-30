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
import { ModelConfigService } from './model-config.service';
import { IsString, IsOptional, IsBoolean, IsInt, IsEnum, IsObject, Min } from 'class-validator';
import { ModelType, ModelVisibility } from '../../platform/prisma/generated';
import { Public } from '../../identity/auth/decorators/public.decorator';
import type { AuthUser } from '@autix/domain';

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
}

@UseGuards(JwtAuthGuard)
@Controller('models')
export class ModelConfigController {
  constructor(private readonly modelConfigService: ModelConfigService) {}

  @Get('available')
  async findAvailable(@CurrentUser() user: AuthUser) {
    const userId = getCurrentUserId(user);
    return this.modelConfigService.findAvailableGeneralModels(userId);
  }

  @Public()
  @Get('public/available')
  async findPublicAvailable() {
    return this.modelConfigService.findAvailablePublicModels();
  }

  @Get('default/:type')
  async findDefault(@CurrentUser() user: AuthUser, @Param('type') type: ModelType) {
    const userId = getCurrentUserId(user);
    return this.modelConfigService.findDefaultByTypeForUser(type, userId);
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
