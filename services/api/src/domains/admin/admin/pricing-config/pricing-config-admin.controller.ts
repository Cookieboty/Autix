import { Body, Controller, Get, Param, Post, Put, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { JwtAuthGuard } from '../../../identity/auth/jwt-auth.guard';
import { AdminGuard } from '../../../identity/auth/admin.guard';
import { PermissionsGuard } from '../../../identity/auth/guards/permissions.guard';
import { PricingConfigAdminService } from './pricing-config-admin.service';
import {
  DryRunPricingDto,
  UpdateModelDescriptionDto,
  UpdateModelSchemasDto,
} from './dto/pricing-config-admin.dto';

/**
 * Admin-only: model schema/description editing + a pricing dry-run. Shares the `admin` route
 * prefix with `AdminController` (Nest allows multiple controllers on one prefix as long as the
 * concrete paths don't collide) and reuses the same class-level guard stack as the rest of
 * `admin.controller.ts` — no `@Permissions(...)`, matching the existing
 * `points/pricing-rules*` endpoints which also rely on `AdminGuard` alone.
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
}
