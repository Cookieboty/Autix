import { BadRequestException, Injectable } from '@nestjs/common';
import { AppLogger } from '../../platform/common/app-logger';
import { getCurrentUserId } from '../../identity/auth/decorators/current-user.decorator';
import { OrderService } from '../../billing/order/order.service';
import { StripePaymentService } from '../../billing/order/stripe-payment.service';
import { PointsService } from '../../billing/points/points.service';
import { RegistrationService } from '../../identity/registration/registration.service';
import { MembershipService } from '../../billing/membership/membership.service';
import {
  PointGrantType,
  PointLedgerEventType,
  PointsSource,
} from '../../platform/prisma/generated';
import type { RefundOrderInput } from '../../billing/order/services/order-refund.helpers';
import {
  ApproveUserDto,
  FulfillOrderDto,
  GrantMembershipDto,
  GrantPointsDto,
  RefundOrderDto,
  UpsertMembershipLevelDto,
  UpsertMembershipPlanDto,
  UpsertPointsPackageDto,
} from './dto/admin-write.dto';
import { AdminAuditStore } from './admin-audit.store';
import { BatchJobService } from './batch-job.service';
import { AdminRepository } from './admin.repository';
import type { AuthUser } from '@autix/domain';
import {
  buildAdminAuditRecord,
  buildFulfillOrderAuditPayload,
  buildGrantPointsDecision,
  buildManualPaymentInput,
  buildPointsPackageCreateData,
  buildPointsPackageWriteData,
  buildRefundOrderAuditPayload,
  buildRefundOrderInput,
  mergeRefundProviderInput,
  idAuditPayload,
  normalizeAdminPagination,
  normalizeAuditLogQuery,
  normalizeOrderListQuery,
  normalizePointsRecordsQuery,
  normalizeUserPointsDetailLimits,
  normalizeUserSummariesQuery,
  pickAuditPayload,
} from './admin.helpers';

@Injectable()
export class AdminService {
  private readonly auditLogger = new AppLogger('AdminAudit');

  constructor(
    private readonly adminRepository: AdminRepository,
    private readonly registrationService: RegistrationService,
    private readonly batchJobService: BatchJobService,
    private readonly pointsService: PointsService,
    private readonly orderService: OrderService,
    private readonly stripePaymentService: StripePaymentService,
    private readonly auditStore: AdminAuditStore,
    private readonly membershipService: MembershipService,
  ) {}

  getAuditLogs(input: {
    action?: string;
    actorId?: string;
    limit?: string;
    cursor?: string;
  }) {
    return this.auditStore.query(normalizeAuditLogQuery(input));
  }

  listBatchJobs(user: AuthUser, page = '1', pageSize = '20') {
    const userId = getCurrentUserId(user);
    const pagination = normalizeAdminPagination(page, pageSize);
    return this.batchJobService.listJobs(userId, pagination.page, pagination.pageSize);
  }

  getBatchJob(id: string) {
    return this.batchJobService.getJob(id);
  }

  getMembershipLevels() {
    return this.adminRepository.getMembershipLevels();
  }

  createMembershipLevel(user: AuthUser, body: UpsertMembershipLevelDto) {
    this.audit(user, 'membership_levels.create', pickAuditPayload(body, ['name', 'level']));
    return this.membershipService.createLevel(
      body as unknown as Record<string, unknown>,
    );
  }

  updateMembershipLevel(user: AuthUser, id: string, body: UpsertMembershipLevelDto) {
    this.audit(user, 'membership_levels.update', idAuditPayload(id));
    return this.membershipService.updateLevel(
      id,
      body as unknown as Record<string, unknown>,
    );
  }

  deleteMembershipLevel(user: AuthUser, id: string) {
    this.audit(user, 'membership_levels.delete', idAuditPayload(id));
    return this.membershipService.deleteLevel(id);
  }

  getMembershipPlans() {
    return this.adminRepository.getMembershipPlans();
  }

  createMembershipPlan(user: AuthUser, body: UpsertMembershipPlanDto) {
    this.audit(
      user,
      'membership_plans.create',
      pickAuditPayload(body, ['levelId', 'billingCycle', 'months', 'price']),
    );
    return this.membershipService.createPlan(
      body as unknown as Record<string, unknown>,
    );
  }

  updateMembershipPlan(user: AuthUser, id: string, body: UpsertMembershipPlanDto) {
    this.audit(user, 'membership_plans.update', idAuditPayload(id));
    return this.membershipService.updatePlan(
      id,
      body as unknown as Record<string, unknown>,
    );
  }

  deleteMembershipPlan(user: AuthUser, id: string) {
    this.audit(user, 'membership_plans.delete', idAuditPayload(id));
    return this.membershipService.deletePlan(id);
  }

  getPointsPackages() {
    return this.adminRepository.getPointsPackages();
  }

  createPointsPackage(user: AuthUser, body: UpsertPointsPackageDto) {
    this.audit(user, 'points_packages.create', pickAuditPayload(body, ['name', 'points']));
    return this.adminRepository.createPointsPackage(
      buildPointsPackageCreateData(body as unknown as Record<string, unknown>),
    );
  }

  updatePointsPackage(user: AuthUser, id: string, body: UpsertPointsPackageDto) {
    this.audit(user, 'points_packages.update', idAuditPayload(id));
    return this.adminRepository.updatePointsPackage(
      id,
      buildPointsPackageWriteData(body as unknown as Record<string, unknown>),
    );
  }

  deletePointsPackage(user: AuthUser, id: string) {
    this.audit(user, 'points_packages.delete', idAuditPayload(id));
    return this.adminRepository.deletePointsPackage(id);
  }

  async getOrders(input: {
    page?: string;
    pageSize?: string;
    userId?: string;
    status?: string;
    orderType?: string;
  }) {
    return this.adminRepository.listOrders(normalizeOrderListQuery(input));
  }

  fulfillOrder(user: AuthUser, id: string, body: FulfillOrderDto) {
    const operatorId = getCurrentUserId(user);
    this.audit(user, 'orders.fulfill', buildFulfillOrderAuditPayload(id, body));
    return this.orderService.confirmManualPayment(
      id,
      buildManualPaymentInput(operatorId, body),
    );
  }

  async refundOrder(user: AuthUser, id: string, body: RefundOrderDto) {
    const operatorId = getCurrentUserId(user);
    this.audit(user, 'orders.refund', buildRefundOrderAuditPayload(id, body));
    let refundInput: RefundOrderInput = buildRefundOrderInput(operatorId, body);
    const order = await this.orderService.getOrderForAdmin(id);
    if (order.status === 'PAID' && order.paymentProvider === 'stripe') {
      const stripeRefund = await this.stripePaymentService.createRefund({
        order,
        amount: body.amount,
        externalRefundId: body.externalRefundId,
        reason: body.reason,
        metadata: {
          operatorId,
          remark: body.remark,
        },
      });
      refundInput = mergeRefundProviderInput(refundInput, stripeRefund);
    }
    const result = await this.orderService.refundOrder(id, refundInput);

    // FIX-1: 撤销会员权益后，尽力取消对应的 Stripe 订阅（失败不阻塞退款）。
    if (result.membershipRevoked && result.cancelSubscriptionId) {
      try {
        await this.stripePaymentService.cancelSubscriptionImmediately(result.cancelSubscriptionId);
      } catch (error) {
        this.auditLogger.error(
          `退款撤销会员后取消 Stripe 订阅失败 order=${id} subscription=${result.cancelSubscriptionId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
    return result;
  }

  async getPointsRecords(input: {
    page?: string;
    pageSize?: string;
    userId?: string;
    source?: string;
  }) {
    return this.adminRepository.listPointsRecords(normalizePointsRecordsQuery(input));
  }

  async getUsers(page = '1', pageSize = '20', search = '') {
    return this.adminRepository.listUserSummaries(
      normalizeUserSummariesQuery(page, pageSize, search),
    );
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
    return this.adminRepository.getUserPointsDetail({
      userId,
      ...normalizeUserPointsDetailLimits(grantTake, holdTake, recordTake),
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
    const pkg = body.packageId
      ? await this.adminRepository.findPointsPackage(body.packageId)
      : undefined;
    const decision = buildGrantPointsDecision(body, pkg);

    this.audit(user, 'users.grant_points', {
      userId,
      points: decision.pointsToGrant,
      packageId: body.packageId,
    });

    const current = await this.adminRepository.runPointGrantTransaction(async (tx) => {
      const result = await this.pointsService.grantPointsWithinTx(tx, userId, {
        amount: decision.pointsToGrant,
        grantType: decision.grantType,
        sourceEvent: PointLedgerEventType.admin_adjustment,
        source: PointsSource.ADMIN_GRANT,
        remark: decision.remark,
      });

      return { balance: result.balance };
    });

    return { message: '授予成功', balance: current.balance };
  }

  private audit(user: AuthUser, action: string, payload: Record<string, unknown>) {
    const actorId = getCurrentUserId(user);
    const entry = buildAdminAuditRecord(actorId, action, payload);
    this.auditLogger.log(JSON.stringify(entry));
    this.auditStore.record(entry);
  }
}
