import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../identity/auth/jwt-auth.guard';
import { CurrentUser } from '../../identity/auth/decorators/current-user.decorator';
import { AdminGuard } from '../../identity/auth/admin.guard';
import { PermissionsGuard } from '../../identity/auth/guards/permissions.guard';
import { Permissions } from '../../identity/auth/decorators/permissions.decorator';
import {
  ApproveUserDto,
  FulfillOrderDto,
  GrantMembershipDto,
  GrantPointsDto,
  RefundOrderDto,
  UpsertMembershipLevelDto,
  UpsertMembershipPlanDto,
  UpsertPointsPackageDto,
  UpsertPricingRuleDto,
  PreviewPricingRuleInputDto,
} from './dto/admin-write.dto';
import { AdminService } from './admin.service';
import type { AuthUser } from '@autix/domain';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard, PermissionsGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('audit-logs')
  async getAuditLogs(
    @Query('action') action?: string,
    @Query('actorId') actorId?: string,
    @Query('limit') limit = '50',
    @Query('cursor') cursor?: string,
  ) {
    return this.adminService.getAuditLogs({ action, actorId, limit, cursor });
  }

  @Get('batch-jobs')
  async listBatchJobs(
    @CurrentUser() user: AuthUser,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ) {
    return this.adminService.listBatchJobs(user, page, pageSize);
  }

  @Get('batch-jobs/:id')
  async getBatchJob(@Param('id') id: string) {
    return this.adminService.getBatchJob(id);
  }

  @Get('membership/levels')
  async getMembershipLevels() {
    return this.adminService.getMembershipLevels();
  }

  @Post('membership/levels')
  async createMembershipLevel(
    @CurrentUser() user: AuthUser,
    @Body() body: UpsertMembershipLevelDto,
  ) {
    return this.adminService.createMembershipLevel(user, body);
  }

  @Put('membership/levels/:id')
  async updateMembershipLevel(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: UpsertMembershipLevelDto,
  ) {
    return this.adminService.updateMembershipLevel(user, id, body);
  }

  @Delete('membership/levels/:id')
  async deleteMembershipLevel(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.adminService.deleteMembershipLevel(user, id);
  }

  @Get('membership/plans')
  async getMembershipPlans() {
    return this.adminService.getMembershipPlans();
  }

  @Post('membership/plans')
  async createMembershipPlan(
    @CurrentUser() user: AuthUser,
    @Body() body: UpsertMembershipPlanDto,
  ) {
    return this.adminService.createMembershipPlan(user, body);
  }

  @Put('membership/plans/:id')
  async updateMembershipPlan(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: UpsertMembershipPlanDto,
  ) {
    return this.adminService.updateMembershipPlan(user, id, body);
  }

  @Delete('membership/plans/:id')
  async deleteMembershipPlan(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.adminService.deleteMembershipPlan(user, id);
  }

  @Get('points/packages')
  async getPointsPackages() {
    return this.adminService.getPointsPackages();
  }

  @Post('points/packages')
  async createPointsPackage(
    @CurrentUser() user: AuthUser,
    @Body() body: UpsertPointsPackageDto,
  ) {
    return this.adminService.createPointsPackage(user, body);
  }

  @Put('points/packages/:id')
  async updatePointsPackage(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: UpsertPointsPackageDto,
  ) {
    return this.adminService.updatePointsPackage(user, id, body);
  }

  @Get('points/pricing-rules')
  async getPricingRules() {
    return this.adminService.getPricingRules();
  }

  @Post('points/pricing-rules')
  async createPricingRule(
    @CurrentUser() user: AuthUser,
    @Body() body: UpsertPricingRuleDto,
  ) {
    return this.adminService.createPricingRule(user, body);
  }

  @Put('points/pricing-rules/:id')
  async updatePricingRule(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: UpsertPricingRuleDto,
  ) {
    return this.adminService.updatePricingRule(user, id, body);
  }

  @Post('points/pricing-rules/preview')
  async previewPricingRule(@Body() body: PreviewPricingRuleInputDto) {
    return this.adminService.previewPricingRule(body);
  }

  @Get('orders')
  async getOrders(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('userId') userId?: string,
    @Query('status') status?: string,
    @Query('orderType') orderType?: string,
  ) {
    return this.adminService.getOrders({ page, pageSize, userId, status, orderType });
  }

  @Post('orders/:id/fulfill')
  @Permissions('payment:fulfill')
  async fulfillOrder(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: FulfillOrderDto,
  ) {
    return this.adminService.fulfillOrder(user, id, body);
  }

  @Post('orders/:id/refund')
  @Permissions('payment:refund')
  async refundOrder(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: RefundOrderDto,
  ) {
    return this.adminService.refundOrder(user, id, body);
  }

  @Get('points/records')
  async getPointsRecords(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('userId') userId?: string,
    @Query('source') source?: string,
  ) {
    return this.adminService.getPointsRecords({ page, pageSize, userId, source });
  }

  @Get('users')
  async getUsers(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('search') search = '',
  ) {
    return this.adminService.getUsers(page, pageSize, search);
  }

  @Get('users/:userId')
  async getUserDetail(@Param('userId') userId: string) {
    return this.adminService.getUserDetail(userId);
  }

  @Get('users/:userId/points-detail')
  async getUserPointsDetail(
    @Param('userId') userId: string,
    @Query('grantTake') grantTake = '50',
    @Query('holdTake') holdTake = '20',
    @Query('recordTake') recordTake = '50',
  ) {
    return this.adminService.getUserPointsDetail(userId, grantTake, holdTake, recordTake);
  }

  @Post('users/:userId/approve')
  async approveUser(
    @CurrentUser() user: AuthUser,
    @Param('userId') userId: string,
    @Body() body: ApproveUserDto,
  ) {
    return this.adminService.approveUser(user, userId, body);
  }

  @Post('users/:userId/grant-membership')
  async grantMembership(
    @CurrentUser() user: AuthUser,
    @Param('userId') userId: string,
    @Body() body: GrantMembershipDto,
  ) {
    return this.adminService.grantMembership(user, userId, body);
  }

  @Post('users/:userId/grant-points')
  async grantPoints(
    @CurrentUser() user: AuthUser,
    @Param('userId') userId: string,
    @Body() body: GrantPointsDto,
  ) {
    return this.adminService.grantPoints(user, userId, body);
  }
}
