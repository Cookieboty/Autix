import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { getCurrentUserId } from '../../identity/auth/decorators/current-user.decorator';
import { OrderService } from '../../billing/order/order.service';
import { PointsService } from '../../billing/points/points.service';
import { RegistrationService } from '../../identity/registration/registration.service';
import { MembershipService } from '../../billing/membership/membership.service';
import {
  PointGrantType,
  PointLedgerEventType,
  PointsSource,
  Prisma,
} from '../../platform/prisma/generated';
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
import { AdminAuditStore } from './admin-audit.store';
import { BatchJobService } from './batch-job.service';
import { AdminRepository } from './admin.repository';
import type { AuthUser } from '@autix/domain';

@Injectable()
export class AdminService {
  private readonly auditLogger = new Logger('AdminAudit');

  constructor(
    private readonly adminRepository: AdminRepository,
    private readonly registrationService: RegistrationService,
    private readonly batchJobService: BatchJobService,
    private readonly pointsService: PointsService,
    private readonly orderService: OrderService,
    private readonly auditStore: AdminAuditStore,
    private readonly membershipService: MembershipService,
  ) {}

  getAuditLogs(input: {
    action?: string;
    actorId?: string;
    limit?: string;
    cursor?: string;
  }) {
    return this.auditStore.query({
      action: input.action,
      actorId: input.actorId,
      limit: parseInt(input.limit ?? '50', 10) || 50,
      cursor: input.cursor ? parseInt(input.cursor, 10) || undefined : undefined,
    });
  }

  listBatchJobs(user: AuthUser, page = '1', pageSize = '20') {
    const userId = getCurrentUserId(user);
    return this.batchJobService.listJobs(
      userId,
      parseInt(page, 10) || 1,
      parseInt(pageSize, 10) || 20,
    );
  }

  getBatchJob(id: string) {
    return this.batchJobService.getJob(id);
  }

  getMembershipLevels() {
    return this.adminRepository.getMembershipLevels();
  }

  createMembershipLevel(user: AuthUser, body: UpsertMembershipLevelDto) {
    this.audit(user, 'membership_levels.create', { name: body.name, level: body.level });
    return this.membershipService.createLevel(
      body as unknown as Record<string, unknown>,
    );
  }

  updateMembershipLevel(user: AuthUser, id: string, body: UpsertMembershipLevelDto) {
    this.audit(user, 'membership_levels.update', { id });
    return this.membershipService.updateLevel(
      id,
      body as unknown as Record<string, unknown>,
    );
  }

  getMembershipPlans() {
    return this.adminRepository.getMembershipPlans();
  }

  createMembershipPlan(user: AuthUser, body: UpsertMembershipPlanDto) {
    this.audit(user, 'membership_plans.create', {
      levelId: body.levelId,
      billingCycle: body.billingCycle,
      months: body.months,
      price: body.price,
    });
    return this.membershipService.createPlan(
      body as unknown as Record<string, unknown>,
    );
  }

  updateMembershipPlan(user: AuthUser, id: string, body: UpsertMembershipPlanDto) {
    this.audit(user, 'membership_plans.update', { id });
    return this.membershipService.updatePlan(
      id,
      body as unknown as Record<string, unknown>,
    );
  }

  getPointsPackages() {
    return this.adminRepository.getPointsPackages();
  }

  createPointsPackage(user: AuthUser, body: UpsertPointsPackageDto) {
    this.audit(user, 'points_packages.create', { name: body.name, points: body.points });
    return this.adminRepository.createPointsPackage(
      this.buildPointsPackageWriteData(
        body as unknown as Record<string, unknown>,
        ['name', 'price', 'points'],
      ) as Prisma.points_packagesUncheckedCreateInput,
    );
  }

  updatePointsPackage(user: AuthUser, id: string, body: UpsertPointsPackageDto) {
    this.audit(user, 'points_packages.update', { id });
    return this.adminRepository.updatePointsPackage(
      id,
      this.buildPointsPackageWriteData(body as unknown as Record<string, unknown>),
    );
  }

  getPricingRules() {
    return this.adminRepository.getPricingRules();
  }

  createPricingRule(user: AuthUser, body: UpsertPricingRuleDto) {
    this.audit(user, 'generation_pricing_rules.create', {
      taskType: body.taskType,
      name: body.name,
      baseCost: body.baseCost,
    });
    return this.adminRepository.createPricingRule(
      body as Prisma.generation_pricing_rulesUncheckedCreateInput,
    );
  }

  updatePricingRule(user: AuthUser, id: string, body: UpsertPricingRuleDto) {
    this.audit(user, 'generation_pricing_rules.update', { id, baseCost: body.baseCost });
    return this.adminRepository.updatePricingRule(
      id,
      body as Prisma.generation_pricing_rulesUncheckedUpdateInput,
    );
  }

  previewPricingRule(body: PreviewPricingRuleInputDto) {
    return this.pointsService.previewPricingRule(
      body as unknown as Parameters<PointsService['previewPricingRule']>[0],
    );
  }

  async getOrders(input: {
    page?: string;
    pageSize?: string;
    userId?: string;
    status?: string;
    orderType?: string;
  }) {
    const p = parseInt(input.page ?? '1', 10) || 1;
    const ps = parseInt(input.pageSize ?? '20', 10) || 20;
    return this.adminRepository.listOrders({
      page: p,
      pageSize: ps,
      userId: input.userId,
      status: input.status,
      orderType: input.orderType,
    });
  }

  fulfillOrder(user: AuthUser, id: string, body: FulfillOrderDto = {}) {
    this.audit(user, 'orders.fulfill', {
      id,
      externalPaymentId: body.externalPaymentId,
      amount: body.amount,
    });
    return this.orderService.confirmManualPayment(id, {
      operatorId: getCurrentUserId(user),
      externalPaymentId: body.externalPaymentId,
      amount: body.amount,
      currency: body.currency,
      remark: body.remark,
    });
  }

  refundOrder(user: AuthUser, id: string, body: RefundOrderDto = {}) {
    this.audit(user, 'orders.refund', {
      id,
      amount: body.amount,
      reclaimPoints: body.reclaimPoints,
      reason: body.reason,
    });
    return this.orderService.refundOrder(id, {
      provider: 'admin_manual',
      externalRefundId: body.externalRefundId,
      amount: body.amount,
      currency: body.currency,
      reclaimPoints: body.reclaimPoints,
      maxPointsToReclaim: body.maxPointsToReclaim,
      reason: body.reason ?? body.remark ?? 'admin refund',
      metadata: {
        operatorId: getCurrentUserId(user),
        remark: body.remark,
      },
    });
  }

  async getPointsRecords(input: {
    page?: string;
    pageSize?: string;
    userId?: string;
    source?: string;
  }) {
    const p = parseInt(input.page ?? '1', 10) || 1;
    const ps = parseInt(input.pageSize ?? '20', 10) || 20;
    return this.adminRepository.listPointsRecords({
      page: p,
      pageSize: ps,
      userId: input.userId,
      source: input.source,
    });
  }

  async getUsers(page = '1', pageSize = '20', search = '') {
    const p = parseInt(page, 10) || 1;
    const ps = parseInt(pageSize, 10) || 20;
    return this.adminRepository.listUserSummaries({ page: p, pageSize: ps, search });
  }

  async getUserDetail(userId: string) {
    return this.adminRepository.getUserDetail(userId);
  }

  async getUserPointsDetail(
    userId: string,
    grantTake = '50',
    holdTake = '20',
    recordTake = '50',
  ) {
    const grantLimit = Math.min(Math.max(parseInt(grantTake, 10) || 50, 1), 200);
    const holdLimit = Math.min(Math.max(parseInt(holdTake, 10) || 20, 1), 100);
    const recordLimit = Math.min(Math.max(parseInt(recordTake, 10) || 50, 1), 200);

    return this.adminRepository.getUserPointsDetail({
      userId,
      grantLimit,
      holdLimit,
      recordLimit,
    });
  }

  async approveUser(user: AuthUser, userId: string, body: ApproveUserDto) {
    const registration = await this.adminRepository.findPendingRegistrationByUser(userId);
    if (!registration) {
      throw new BadRequestException('没有待审批的注册申请');
    }
    this.audit(user, 'users.approve', { userId, note: body.note });
    return this.registrationService.approve(registration.id, user, { note: body.note });
  }

  async grantMembership(user: AuthUser, userId: string, body: GrantMembershipDto) {
    const { levelId, months = 1 } = body;

    const level = await this.adminRepository.findMembershipLevel(levelId);
    if (!level) throw new BadRequestException('会员等级不存在');

    const now = new Date();
    const expiresAt = OrderService.addMonths(now, Math.max(1, months));
    const pointsToGrant = level.pointsPerMonth;

    this.audit(user, 'users.grant_membership', { userId, levelId, months });

    await this.adminRepository.runMembershipGrantTransaction(
      { userId, levelId, startedAt: now, expiresAt },
      pointsToGrant > 0
        ? async (tx) => {
            await this.pointsService.grantPointsWithinTx(tx, userId, {
              amount: pointsToGrant,
              grantType: PointGrantType.SUBSCRIPTION,
              sourceEvent: PointLedgerEventType.admin_adjustment,
              source: PointsSource.ADMIN_GRANT,
              expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
              remark: `管理员授予 ${level.name} 当前周期积分`,
              metadata: { months, grantPolicy: 'current_cycle_only' },
            });
          }
        : undefined,
    );

    return { message: '授予成功' };
  }

  async grantPoints(user: AuthUser, userId: string, body: GrantPointsDto) {
    let pointsToGrant: number;
    let remark: string;

    if (body.packageId) {
      const pkg = await this.adminRepository.findPointsPackage(body.packageId);
      if (!pkg) throw new BadRequestException('积分包不存在');
      pointsToGrant = pkg.points;
      remark = body.remark || `管理员授予积分包: ${pkg.name}`;
    } else if (body.points && body.points > 0) {
      pointsToGrant = body.points;
      remark = body.remark || '管理员手动授予积分';
    } else {
      throw new BadRequestException('请提供 points 或 packageId');
    }

    this.audit(user, 'users.grant_points', {
      userId,
      points: pointsToGrant,
      packageId: body.packageId,
    });

    const current = await this.adminRepository.runPointGrantTransaction(async (tx) => {
      const grantType = body.packageId ? PointGrantType.PURCHASED : PointGrantType.COMPENSATION;
      const result = await this.pointsService.grantPointsWithinTx(tx, userId, {
        amount: pointsToGrant,
        grantType,
        sourceEvent: PointLedgerEventType.admin_adjustment,
        source: PointsSource.ADMIN_GRANT,
        remark,
      });

      return { balance: result.balance };
    });

    return { message: '授予成功', balance: current.balance };
  }

  private buildPointsPackageWriteData(
    input: Record<string, unknown>,
    required: string[] = [],
  ): Prisma.points_packagesUncheckedUpdateInput {
    this.assertRequired(input, required);
    const data: Prisma.points_packagesUncheckedUpdateInput = {};

    if (this.has(input, 'code')) data.code = this.nullableString(input.code, 'code');
    if (this.has(input, 'name')) data.name = this.requiredString(input.name, 'name');
    if (this.has(input, 'description')) {
      data.description = this.nullableString(input.description, 'description');
    }
    if (this.has(input, 'price')) data.price = this.nonNegativeDecimal(input.price, 'price');
    if (this.has(input, 'points')) data.points = this.positiveInt(input.points, 'points');
    if (this.has(input, 'validityDays')) {
      data.validityDays = this.positiveInt(input.validityDays, 'validityDays');
    }
    if (this.has(input, 'usageScope')) data.usageScope = this.toNullableJson(input.usageScope);
    if (this.has(input, 'showCommercialLicense')) {
      data.showCommercialLicense = this.boolean(
        input.showCommercialLicense,
        'showCommercialLicense',
      );
    }
    if (this.has(input, 'isActive')) data.isActive = this.boolean(input.isActive, 'isActive');
    if (this.has(input, 'sort')) data.sort = this.nonNegativeInt(input.sort, 'sort');

    return data;
  }

  private assertRequired(input: Record<string, unknown>, fields: string[]) {
    for (const field of fields) {
      if (
        !this.has(input, field) ||
        input[field] === undefined ||
        input[field] === null ||
        input[field] === ''
      ) {
        throw new BadRequestException(`缺少必填字段: ${field}`);
      }
    }
  }

  private has(input: Record<string, unknown>, field: string) {
    return Object.prototype.hasOwnProperty.call(input, field);
  }

  private requiredString(value: unknown, field: string) {
    if (typeof value !== 'string') {
      throw new BadRequestException(`${field} 必须为字符串`);
    }
    const trimmed = value.trim();
    if (!trimmed) {
      throw new BadRequestException(`${field} 不能为空`);
    }
    return trimmed;
  }

  private nullableString(value: unknown, field: string) {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value !== 'string') {
      throw new BadRequestException(`${field} 必须为字符串`);
    }
    const trimmed = value.trim();
    return trimmed || null;
  }

  private nonNegativeInt(value: unknown, field: string) {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0) {
      throw new BadRequestException(`${field} 必须为非负整数`);
    }
    return n;
  }

  private positiveInt(value: unknown, field: string) {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1) {
      throw new BadRequestException(`${field} 必须为正整数`);
    }
    return n;
  }

  private nonNegativeDecimal(value: unknown, field: string) {
    if (value === null || value === undefined || value === '') {
      throw new BadRequestException(`${field} 不能为空`);
    }
    if (typeof value !== 'string' && typeof value !== 'number') {
      throw new BadRequestException(`${field} 必须为金额`);
    }
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) {
      throw new BadRequestException(`${field} 必须为非负金额`);
    }
    return typeof value === 'string' ? value.trim() : value;
  }

  private boolean(value: unknown, field: string) {
    if (typeof value !== 'boolean') {
      throw new BadRequestException(`${field} 必须为布尔值`);
    }
    return value;
  }

  private toNullableJson(
    value: unknown,
  ): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
    if (value === null || value === undefined || value === '') return Prisma.JsonNull;
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  private audit(user: AuthUser, action: string, payload: Record<string, unknown>) {
    const actorId = getCurrentUserId(user);
    const at = new Date().toISOString();
    this.auditLogger.log(
      JSON.stringify({
        action,
        actorId,
        at,
        payload,
      }),
    );
    this.auditStore.record({ action, actorId, at, payload });
  }
}
