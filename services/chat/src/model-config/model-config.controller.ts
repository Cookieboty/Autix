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
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ModelConfigService } from './model-config.service';
import { IsString, IsOptional, IsBoolean, IsInt, IsEnum, IsObject, Min } from 'class-validator';
import { ModelType, ModelVisibility } from '@prisma/client';

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

  // capabilities：模型的感知能力标签数组，支持多标签。
  // 推荐值：text | vision | voice | speech | code | reasoning | image | embedding
  // 例如：["text"] / ["text", "vision"] / ["voice", "speech"]
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

  // capabilities：模型的感知能力标签数组，支持多标签。
  // 推荐值：text | vision | voice | speech | code | reasoning | image | embedding
  @IsOptional()
  @IsString({ each: true })
  capabilities?: string[];
}

@UseGuards(JwtAuthGuard)
@Controller('api/models')
export class ModelConfigController {
  constructor(private readonly modelConfigService: ModelConfigService) {}

  /**
   * 获取当前用户可用的 general 模型列表（前端模型选择器用）。
   * 返回数据按 private → public 分组，每组内按 isDefault → priority 排序。
   */
  @Get('available')
  async findAvailable(@Req() req: Request) {
    const userId = (req.user as any).userId;
    return this.modelConfigService.findAvailableGeneralModels(userId);
  }

  /**
   * 获取某类型的默认模型（未传 modelId 时兜底用）。
   * 私人默认优先，再公开默认。
   */
  @Get('default/:type')
  async findDefault(@Req() req: Request, @Param('type') type: ModelType) {
    const userId = (req.user as any).userId;
    return this.modelConfigService.findDefaultByTypeForUser(type, userId);
  }

  /**
   * 管理后台：获取所有模型配置
   */
  @Get('admin')
  async findAll() {
    return this.modelConfigService.findAll();
  }

  /**
   * 管理后台：按 ID 获取单个模型
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.modelConfigService.findById(id);
  }

  /**
   * 管理后台：创建模型配置
   */
  @Post()
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async create(@Req() req: Request, @Body() dto: CreateModelConfigDto) {
    const userId = (req.user as any).userId;
    return this.modelConfigService.create(dto, userId);
  }

  /**
   * 管理后台：更新模型配置
   */
  @Put(':id')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async update(@Param('id') id: string, @Body() dto: UpdateModelConfigDto) {
    return this.modelConfigService.update(id, dto);
  }

  /**
   * 管理后台：删除模型配置
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.modelConfigService.delete(id);
  }
}
