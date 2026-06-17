import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { ModelConfigService } from './model-config.service';
import { IsString, IsOptional, IsBoolean, IsInt, IsEnum, IsObject, Min } from 'class-validator';
import { ModelType, ModelVisibility } from '../prisma/generated';
import { SystemSettingsService } from '../system-settings/system-settings.service';

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
}

@UseGuards(JwtAuthGuard)
@Controller('models')
export class ModelConfigController {
  constructor(
    private readonly modelConfigService: ModelConfigService,
    private readonly systemSettingsService: SystemSettingsService,
  ) {}

  private async assertModelConfigEnabled() {
    if (!(await this.systemSettingsService.getBoolean('features.modelConfigEnabled'))) {
      throw new ForbiddenException('模型配置功能已关闭');
    }
  }

  @Get('available')
  async findAvailable(@Req() req: Request) {
    const userId = (req.user as any).userId;
    return this.modelConfigService.findAvailableGeneralModels(userId);
  }

  @Get('default/:type')
  async findDefault(@Req() req: Request, @Param('type') type: ModelType) {
    const userId = (req.user as any).userId;
    return this.modelConfigService.findDefaultByTypeForUser(type, userId);
  }

  @Get('admin')
  async findAll(@Req() req: Request) {
    await this.assertModelConfigEnabled();
    const userId = (req.user as any).userId;
    return this.modelConfigService.findAllForUser(userId);
  }

  @Get('system')
  @UseGuards(AdminGuard)
  async findSystemModels() {
    return this.modelConfigService.findSystemModels();
  }

  @Get(':id')
  async findOne(@Req() req: Request, @Param('id') id: string) {
    await this.assertModelConfigEnabled();
    const userId = (req.user as any).userId;
    return this.modelConfigService.findOneForUser(id, userId);
  }

  @Post()
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async create(@Req() req: Request, @Body() dto: CreateModelConfigDto) {
    await this.assertModelConfigEnabled();
    const userId = (req.user as any).userId;
    return this.modelConfigService.create(dto, userId);
  }

  @Post('system')
  @UseGuards(AdminGuard)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async createSystemModel(@Req() req: Request, @Body() dto: CreateModelConfigDto) {
    const userId = (req.user as any).userId;
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
  async update(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateModelConfigDto) {
    await this.assertModelConfigEnabled();
    const userId = (req.user as any).userId;
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
  async remove(@Req() req: Request, @Param('id') id: string) {
    await this.assertModelConfigEnabled();
    const userId = (req.user as any).userId;
    await this.modelConfigService.deleteForUser(id, userId);
  }
}
