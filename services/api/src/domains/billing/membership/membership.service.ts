import {
  Injectable,
  HttpStatus,
} from '@nestjs/common';
import { I18nHttpException } from '../../platform/i18n/i18n-http.exception';
import { BillingCycle, Prisma } from '../../platform/prisma/generated';
import {
  normalizeVideoResolution,
  VIDEO_RESOLUTION_RANK,
  type VideoResolution,
} from '@autix/domain/video';
import { MembershipRepository } from './membership.repository';
import { StripePaymentService } from '../order/stripe-payment.service';
import {
  assertImageConcurrency,
  assertImageEntitlement,
  resolveImageEntitlement,
  type ImageEntitlement,
} from './image-entitlement.helpers';

export interface VideoEntitlement {
  enabled: boolean;
  maxResolution: VideoResolution;
  maxDurationSeconds: number;
  concurrency: number;
  levelName: string;
  level: number;
  source: 'membership' | 'free_default';
}

const FREE_VIDEO_ENTITLEMENT: VideoEntitlement = {
  enabled: false,
  maxResolution: '480p',
  maxDurationSeconds: 0,
  concurrency: 1,
  levelName: 'Free',
  level: 0,
  source: 'free_default',
};

const DEFAULT_MEMBER_VIDEO_ENTITLEMENT = {
  maxResolution: '720p' as const,
  maxDurationSeconds: 5,
  concurrency: 1,
};

function normalizeResolutionForEntitlement(
  raw: unknown,
): VideoResolution {
  return normalizeVideoResolution(raw ?? '480p');
}

function positiveNumberOrDefault(raw: unknown, fallback: number): number {
  return typeof raw === 'number' && Number.isFinite(raw) && raw > 0
    ? raw
    : fallback;
}

@Injectable()
export class MembershipService {
  constructor(
    private readonly repository: MembershipRepository,
    private readonly stripePaymentService: StripePaymentService,
  ) { }

  async resolveActiveMembershipLevelId(userId: string): Promise<string | null> {
    const membership = await this.repository.findUserMembershipWithLevel(userId);
    const now = new Date();
    if (
      !membership ||
      membership.status !== 'ACTIVE' ||
      membership.expiresAt <= now ||
      !membership.level
    ) {
      return null;
    }
    return membership.level.id;
  }

  async resolveActiveMembershipLevel(userId: string): Promise<number> {
    const membership = await this.repository.findUserMembershipWithLevel(userId);
    const now = new Date();
    if (
      !membership ||
      membership.status !== 'ACTIVE' ||
      membership.expiresAt <= now ||
      !membership.level
    ) {
      return 0;
    }
    return membership.level.level;
  }

  async resolveVideoEntitlements(userId: string): Promise<VideoEntitlement> {
    const membership = await this.repository.findUserMembershipWithLevel(userId);
    const now = new Date();
    if (
      !membership ||
      membership.status !== 'ACTIVE' ||
      membership.expiresAt <= now ||
      !membership.level
    ) {
      return FREE_VIDEO_ENTITLEMENT;
    }
    const features = (membership.level.features ?? {}) as Record<string, unknown>;
    const seedance = (features.seedance ?? {}) as Record<string, unknown>;
    return {
      enabled: Boolean(seedance.enabled),
      maxResolution: normalizeResolutionForEntitlement(
        seedance.maxResolution ?? DEFAULT_MEMBER_VIDEO_ENTITLEMENT.maxResolution,
      ),
      maxDurationSeconds: positiveNumberOrDefault(
        seedance.maxDurationSeconds,
        DEFAULT_MEMBER_VIDEO_ENTITLEMENT.maxDurationSeconds,
      ),
      concurrency: positiveNumberOrDefault(
        seedance.concurrency,
        DEFAULT_MEMBER_VIDEO_ENTITLEMENT.concurrency,
      ),
      levelName: membership.level.name,
      level: membership.level.level,
      source: 'membership',
    };
  }

  assertVideoEntitlement(
    entitlement: VideoEntitlement,
    requested: { resolution: VideoResolution; durationSeconds: number },
  ): void {
    if (!entitlement.enabled) {
      throw new I18nHttpException(
        HttpStatus.FORBIDDEN,
        'video_entitlement.membership_required',
        { levelName: entitlement.levelName },
        { code: 'VIDEO_MEMBERSHIP_REQUIRED' },
      );
    }
    const requestRank = VIDEO_RESOLUTION_RANK[requested.resolution] ?? 0;
    const allowedRank = VIDEO_RESOLUTION_RANK[entitlement.maxResolution] ?? 0;
    if (requestRank > allowedRank) {
      throw new I18nHttpException(
        HttpStatus.FORBIDDEN,
        'video_entitlement.resolution_exceeded',
        { levelName: entitlement.levelName, maxResolution: entitlement.maxResolution },
        { code: 'VIDEO_MEMBERSHIP_LIMIT_EXCEEDED' },
      );
    }
    if (requested.durationSeconds > entitlement.maxDurationSeconds) {
      throw new I18nHttpException(
        HttpStatus.FORBIDDEN,
        'video_entitlement.duration_exceeded',
        { levelName: entitlement.levelName, maxDurationSeconds: entitlement.maxDurationSeconds },
        { code: 'VIDEO_MEMBERSHIP_LIMIT_EXCEEDED' },
      );
    }
  }

  async resolveImageEntitlements(userId: string): Promise<ImageEntitlement> {
    const membership = await this.repository.findUserMembershipWithLevel(userId);
    return resolveImageEntitlement(membership, new Date());
  }

  assertImageEntitlement(
    entitlement: ImageEntitlement,
    requested: { size?: string | null; quality?: string | null },
  ): void {
    assertImageEntitlement(entitlement, requested);
  }

  assertImageConcurrency(
    activeCount: number,
    entitlement: ImageEntitlement,
    requestedCount = 1,
  ): void {
    assertImageConcurrency(activeCount, entitlement, requestedCount);
  }

  async getPublicLevels() {
    return this.repository.listPublicLevels();
  }

  async getLevelsForUser(userId: string) {
    const [levels, paidOrder] = await Promise.all([
      this.getPublicLevels(),
      this.repository.findPaidMembershipOrder(userId),
    ]);
    return { levels, isFirstTime: !paidOrder };
  }

  async getUserMembership(userId: string) {
    const [membership, points] = await this.repository.findUserMembershipAndPoints(userId);
    return { membership, pointsBalance: points?.balance ?? 0 };
  }

  async cancelAtPeriodEnd(userId: string) {
    const membership = await this.repository.findUserMembership(userId);
    if (!membership || membership.status !== 'ACTIVE') {
      throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'membership.no_active_cancellable');
    }

    if (membership.stripeSubscriptionId) {
      await this.stripePaymentService.cancelSubscriptionAtPeriodEnd(
        membership.stripeSubscriptionId,
      );
    }

    return this.repository.cancelUserMembershipAtPeriodEnd(userId, new Date());
  }

  /** 创建 Stripe 账单门户会话（管理订阅 / 下载发票 / 支付方式）。 */
  async createBillingPortal(userId: string) {
    const membership = await this.repository.findUserMembership(userId);
    if (!membership?.stripeCustomerId) {
      throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'membership.no_billing_management');
    }
    return this.stripePaymentService.createBillingPortalSession(membership.stripeCustomerId);
  }

  async createLevel(data: Record<string, unknown>) {
    const writeData = this.buildLevelWriteData(data, [
      'name',
      'level',
      'monthlyPrice',
      'pointsPerMonth',
    ]);
    try {
      return await this.repository.createLevel(
        writeData as Prisma.membership_levelsUncheckedCreateInput,
      );
    } catch (err) {
      this.handleLevelWriteError(err);
    }
  }

  async updateLevel(id: string, data: Record<string, unknown>) {
    try {
      return await this.repository.updateLevel(id, this.buildLevelWriteData(data));
    } catch (err) {
      this.handleLevelWriteError(err);
    }
  }

  async createPlan(data: Record<string, unknown>) {
    const writeData = this.buildPlanWriteData(data, [
      'levelId',
      'billingCycle',
      'months',
      'originalPrice',
      'price',
      'points',
    ]);
    return this.repository.createPlan(
      writeData as Prisma.membership_plansUncheckedCreateInput,
    );
  }

  async updatePlan(id: string, data: Record<string, unknown>) {
    return this.repository.updatePlan(id, this.buildPlanWriteData(data));
  }

  async deleteLevel(id: string) {
    try {
      const result = await this.repository.deleteLevel(id);
      if (!result.deleted) {
        throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'membership.tier_has_users');
      }
      return { messageKey: 'common.deleted' };
    } catch (err) {
      this.handleDeleteError(err, 'membership.tier_not_found');
    }
  }

  async deletePlan(id: string) {
    try {
      const result = await this.repository.deletePlan(id);
      if (!result.deleted) {
        throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'membership.plan_has_users');
      }
      return { messageKey: 'common.deleted' };
    } catch (err) {
      this.handleDeleteError(err, 'membership.plan_not_found');
    }
  }

  private buildLevelWriteData(
    input: Record<string, unknown>,
    required: string[] = [],
  ): Prisma.membership_levelsUncheckedUpdateInput {
    this.assertRequired(input, required);
    const data: Prisma.membership_levelsUncheckedUpdateInput = {};

    if (this.has(input, 'name')) data.name = this.requiredString(input.name, 'name');
    if (this.has(input, 'level')) data.level = this.nonNegativeInt(input.level, 'level');
    if (this.has(input, 'monthlyPrice')) {
      data.monthlyPrice = this.nonNegativeDecimal(input.monthlyPrice, 'monthlyPrice');
    }
    if (this.has(input, 'pointsPerMonth')) {
      data.pointsPerMonth = this.nonNegativeInt(input.pointsPerMonth, 'pointsPerMonth');
    }
    if (this.has(input, 'features')) data.features = this.toNullableJson(input.features);
    if (this.has(input, 'isActive')) data.isActive = this.boolean(input.isActive, 'isActive');
    if (this.hasMeaningfulValue(input, 'sort')) data.sort = this.nonNegativeInt(input.sort, 'sort');

    return data;
  }

  private buildPlanWriteData(
    input: Record<string, unknown>,
    required: string[] = [],
  ): Prisma.membership_plansUncheckedUpdateInput {
    this.assertRequired(input, required);
    const data: Prisma.membership_plansUncheckedUpdateInput = {};

    if (this.has(input, 'levelId')) data.levelId = this.requiredString(input.levelId, 'levelId');
    if (this.has(input, 'billingCycle')) {
      const cycle = this.billingCycle(input.billingCycle);
      if (cycle === BillingCycle.QUARTERLY) {
        throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'membership.plan_billing_cycle_invalid');
      }
      data.billingCycle = cycle;
    }
    if (this.has(input, 'months')) data.months = this.positiveInt(input.months, 'months');
    if (this.has(input, 'autoRenew')) {
      const autoRenew = this.boolean(input.autoRenew, 'autoRenew');
      if (!autoRenew) {
        throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'membership.plan_must_be_subscription');
      }
      data.autoRenew = autoRenew;
    } else if (required.length > 0) {
      data.autoRenew = true;
    }
    if (this.has(input, 'originalPrice')) {
      data.originalPrice = this.nonNegativeDecimal(input.originalPrice, 'originalPrice');
    }
    if (this.has(input, 'price')) data.price = this.nonNegativeDecimal(input.price, 'price');
    if (this.has(input, 'firstTimePrice')) {
      data.firstTimePrice = this.nullableDecimal(input.firstTimePrice, 'firstTimePrice');
    }
    if (this.has(input, 'discountLabel')) {
      data.discountLabel = this.nullableString(input.discountLabel, 'discountLabel');
    }
    if (this.has(input, 'firstTimeLabel')) {
      data.firstTimeLabel = this.nullableString(input.firstTimeLabel, 'firstTimeLabel');
    }
    if (this.has(input, 'points')) data.points = this.nonNegativeInt(input.points, 'points');
    if (this.has(input, 'isActive')) data.isActive = this.boolean(input.isActive, 'isActive');

    return data;
  }

  private assertRequired(input: Record<string, unknown>, fields: string[]) {
    for (const field of fields) {
      if (!this.has(input, field) || input[field] === undefined || input[field] === null || input[field] === '') {
        throw new I18nHttpException(
          HttpStatus.BAD_REQUEST,
          'membership.field_required',
          { field },
        );
      }
    }
  }

  private has(input: Record<string, unknown>, field: string) {
    return Object.prototype.hasOwnProperty.call(input, field);
  }

  private hasMeaningfulValue(input: Record<string, unknown>, field: string) {
    return this.has(input, field) && input[field] !== undefined && input[field] !== null && input[field] !== '';
  }

  private handleLevelWriteError(err: unknown): never {
    if ((err as { code?: string })?.code === 'P2002') {
      throw new I18nHttpException(HttpStatus.CONFLICT, 'membership.tier_level_taken');
    }
    throw err;
  }

  private handleDeleteError(err: unknown, notFoundKey: string): never {
    if (err instanceof I18nHttpException) throw err;
    const code = (err as { code?: string })?.code;
    if (code === 'P2025') {
      throw new I18nHttpException(HttpStatus.NOT_FOUND, notFoundKey);
    }
    if (code === 'P2003') {
      throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'membership.record_in_use');
    }
    throw err;
  }

  private requiredString(value: unknown, field: string) {
    if (typeof value !== 'string') {
      throw new I18nHttpException(
        HttpStatus.BAD_REQUEST,
        'membership.field_must_be_string',
        { field },
      );
    }
    const trimmed = value.trim();
    if (!trimmed) {
      throw new I18nHttpException(
        HttpStatus.BAD_REQUEST,
        'membership.field_must_not_be_empty',
        { field },
      );
    }
    return trimmed;
  }

  private nullableString(value: unknown, field: string) {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value !== 'string') {
      throw new I18nHttpException(
        HttpStatus.BAD_REQUEST,
        'membership.field_must_be_string',
        { field },
      );
    }
    const trimmed = value.trim();
    return trimmed || null;
  }

  private nonNegativeInt(value: unknown, field: string) {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0) {
      throw new I18nHttpException(
        HttpStatus.BAD_REQUEST,
        'membership.field_must_be_non_negative_int',
        { field },
      );
    }
    return n;
  }

  private positiveInt(value: unknown, field: string) {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1) {
      throw new I18nHttpException(
        HttpStatus.BAD_REQUEST,
        'membership.field_must_be_positive_int',
        { field },
      );
    }
    return n;
  }

  private nonNegativeDecimal(value: unknown, field: string) {
    if (value === null || value === undefined || value === '') {
      throw new I18nHttpException(
        HttpStatus.BAD_REQUEST,
        'membership.field_must_not_be_empty',
        { field },
      );
    }
    if (typeof value !== 'string' && typeof value !== 'number') {
      throw new I18nHttpException(
        HttpStatus.BAD_REQUEST,
        'membership.field_must_be_amount',
        { field },
      );
    }
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) {
      throw new I18nHttpException(
        HttpStatus.BAD_REQUEST,
        'membership.field_must_be_non_negative_amount',
        { field },
      );
    }
    return typeof value === 'string' ? value.trim() : value;
  }

  private nullableDecimal(value: unknown, field: string) {
    if (value === null || value === undefined || value === '') return null;
    return this.nonNegativeDecimal(value, field);
  }

  private boolean(value: unknown, field: string) {
    if (typeof value !== 'boolean') {
      throw new I18nHttpException(
        HttpStatus.BAD_REQUEST,
        'membership.field_must_be_boolean',
        { field },
      );
    }
    return value;
  }

  private billingCycle(value: unknown) {
    if (!Object.values(BillingCycle).includes(value as BillingCycle)) {
      throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'membership.billing_cycle_invalid');
    }
    return value as BillingCycle;
  }

  private toNullableJson(
    value: unknown,
  ): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
    if (value === null || value === undefined || value === '') return Prisma.JsonNull;
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
