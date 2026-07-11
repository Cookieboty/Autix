import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../identity/auth/jwt-auth.guard';
import { AdminGuard } from '../../../identity/auth/admin.guard';
import { PermissionsGuard } from '../../../identity/auth/guards/permissions.guard';
import { PricingConfigAdminService } from './pricing-config-admin.service';
import {
  CreateDiscountDto,
  CreateTaskDefinitionDto,
  CreateTaskModelBindingDto,
  DryRunPricingDto,
  UpdateDiscountDto,
  UpdateModelDescriptionDto,
  UpdateModelSchemasDto,
  UpdateTaskDefinitionDto,
  UpdateTaskModelBindingDto,
} from './dto/pricing-config-admin.dto';

/**
 * Admin-only: model schema/description editing + a pricing dry-run. Shares the `admin` route
 * prefix with `AdminController` (Nest allows multiple controllers on one prefix as long as the
 * concrete paths don't collide) and reuses the same class-level guard stack as the rest of
 * `admin.controller.ts` — no `@Permissions(...)`, relying on `AdminGuard` alone like the
 * other admin routes.
 */
@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard, PermissionsGuard)
export class PricingConfigAdminController {
  constructor(private readonly service: PricingConfigAdminService) {}

  @Get('models/:id')
  async getModel(@Param('id') id: string) {
    return this.service.getModel(id);
  }

  @Put('models/:id/schemas')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async updateSchemas(@Param('id') id: string, @Body() body: UpdateModelSchemasDto) {
    return this.service.updateModelSchemas(id, body);
  }

  @Put('models/:id/description')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async updateDescription(@Param('id') id: string, @Body() body: UpdateModelDescriptionDto) {
    return this.service.updateModelDescription(id, body.description);
  }

  /** Pure preview — never persists, never creates a hold. */
  @Post('pricing/dry-run')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async dryRun(@Body() body: DryRunPricingDto) {
    return this.service.dryRun(body);
  }

  // =========================================================================
  // task_definitions (Task 18)
  // =========================================================================

  @Get('task-definitions')
  async listTaskDefinitions() {
    return this.service.listTaskDefinitions();
  }

  @Post('task-definitions')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async createTaskDefinition(@Body() body: CreateTaskDefinitionDto) {
    return this.service.createTaskDefinition(body);
  }

  @Put('task-definitions/:taskType')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async updateTaskDefinition(@Param('taskType') taskType: string, @Body() body: UpdateTaskDefinitionDto) {
    return this.service.updateTaskDefinition(taskType, body);
  }

  /** Soft delete — see PricingConfigAdminService.deleteTaskDefinition. */
  @Delete('task-definitions/:taskType')
  async deleteTaskDefinition(@Param('taskType') taskType: string) {
    return this.service.deleteTaskDefinition(taskType);
  }

  // =========================================================================
  // task_model_bindings (Task 19)
  // =========================================================================

  @Get('task-model-bindings')
  async listTaskModelBindings(@Query('taskType') taskType?: string) {
    return this.service.listTaskModelBindings(taskType);
  }

  @Post('task-model-bindings')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async createTaskModelBinding(@Body() body: CreateTaskModelBindingDto) {
    return this.service.createTaskModelBinding(body);
  }

  @Put('task-model-bindings/:taskType/:modelConfigId')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async updateTaskModelBinding(
    @Param('taskType') taskType: string,
    @Param('modelConfigId') modelConfigId: string,
    @Body() body: UpdateTaskModelBindingDto,
  ) {
    return this.service.updateTaskModelBinding(taskType, modelConfigId, body);
  }

  @Delete('task-model-bindings/:taskType/:modelConfigId')
  async deleteTaskModelBinding(
    @Param('taskType') taskType: string,
    @Param('modelConfigId') modelConfigId: string,
  ) {
    return this.service.deleteTaskModelBinding(taskType, modelConfigId);
  }

  // =========================================================================
  // pricing_discounts (Task 20)
  // =========================================================================

  @Get('discounts')
  async listDiscounts() {
    return this.service.listDiscounts();
  }

  @Post('discounts')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async createDiscount(@Body() body: CreateDiscountDto) {
    return this.service.createDiscount(body);
  }

  @Put('discounts/:id')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async updateDiscount(@Param('id') id: string, @Body() body: UpdateDiscountDto) {
    return this.service.updateDiscount(id, body);
  }

  @Delete('discounts/:id')
  async deleteDiscount(@Param('id') id: string) {
    return this.service.deleteDiscount(id);
  }
}
