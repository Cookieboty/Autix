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
import { SystemSettingsService } from '../../platform/system-settings/system-settings.service';
import { assertModelConfigEnabled } from './model-config-access';
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
  constructor(
    private readonly modelConfigService: ModelConfigService,
    private readonly systemSettingsService: SystemSettingsService,
  ) {}

  private async assertModelConfigEnabled() {
    await assertModelConfigEnabled(this.systemSettingsService);
  }

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

  @Get('admin')
  async findAll(@CurrentUser() user: AuthUser) {
    await this.assertModelConfigEnabled();
    const userId = getCurrentUserId(user);
    return this.modelConfigService.findAllForUser(userId);
  }

  @Get('system')
  @UseGuards(AdminGuard)
  async findSystemModels() {
    return this.modelConfigService.findSystemModels();
  }

  @Get(':id')
  async findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.assertModelConfigEnabled();
    const userId = getCurrentUserId(user);
    return this.modelConfigService.findOneForUser(id, userId);
  }

  @Post()
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateModelConfigDto) {
    await this.assertModelConfigEnabled();
    const userId = getCurrentUserId(user);
    return this.modelConfigService.create(dto, userId);
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

  @Put(':id')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateModelConfigDto,
  ) {
    await this.assertModelConfigEnabled();
    const userId = getCurrentUserId(user);
    return this.modelConfigService.update(id, dto, userId);
  }

  @Delete('system/:id')
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeSystemModel(@Param('id') id: string) {
    await this.modelConfigService.deleteSystemModel(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.assertModelConfigEnabled();
    const userId = getCurrentUserId(user);
    await this.modelConfigService.deleteForUser(id, userId);
  }
}
