import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { BillingCycle, Prisma } from '../../platform/prisma/generated';
import {
  normalizeVideoResolution,
  VIDEO_RESOLUTION_RANK,
  type VideoResolution,
} from '@autix/domain/video';
import { MembershipRepository } from './membership.repository';
import { StripePaymentService } from '../order/stripe-payment.service';
import {
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
      throw new ForbiddenException({
        code: 'VIDEO_MEMBERSHIP_REQUIRED',
        message: `当前会员等级（${entitlement.levelName}）未开通视频生成功能，请升级套餐`,
      });
    }
    const requestRank = VIDEO_RESOLUTION_RANK[requested.resolution] ?? 0;
    const allowedRank = VIDEO_RESOLUTION_RANK[entitlement.maxResolution] ?? 0;
    if (requestRank > allowedRank) {
      throw new ForbiddenException({
        code: 'VIDEO_MEMBERSHIP_LIMIT_EXCEEDED',
        message: `当前会员等级（${entitlement.levelName}）最高支持 ${entitlement.maxResolution} 分辨率，请降级分辨率或升级套餐`,
      });
    }
    if (requested.durationSeconds > entitlement.maxDurationSeconds) {
      throw new ForbiddenException({
        code: 'VIDEO_MEMBERSHIP_LIMIT_EXCEEDED',
        message: `当前会员等级（${entitlement.levelName}）单次最长 ${entitlement.maxDurationSeconds} 秒，请缩短时长或升级套餐`,
      });
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
      throw new BadRequestException('当前没有可取消的有效会员');
    }

    if (membership.stripeSubscriptionId) {
      await this.stripePaymentService.cancelSubscriptionAtPeriodEnd(
        membership.stripeSubscriptionId,
      );
    }

    return this.repository.cancelUserMembershipAtPeriodEnd(userId, new Date());
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
        throw new BadRequestException('该会员等级已有用户会员记录，不能直接删除');
      }
      return { message: '删除成功' };
    } catch (err) {
      this.handleDeleteError(err, '会员等级不存在');
    }
  }

  async deletePlan(id: string) {
    try {
      const result = await this.repository.deletePlan(id);
      if (!result.deleted) {
        throw new BadRequestException('该会员计划已有用户会员记录，不能直接删除');
      }
      return { message: '删除成功' };
    } catch (err) {
      this.handleDeleteError(err, '会员计划不存在');
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
        throw new BadRequestException('会员计划仅支持月付或年付');
      }
      data.billingCycle = cycle;
    }
    if (this.has(input, 'months')) data.months = this.positiveInt(input.months, 'months');
    if (this.has(input, 'autoRenew')) {
      const autoRenew = this.boolean(input.autoRenew, 'autoRenew');
      if (!autoRenew) {
        throw new BadRequestException('会员计划仅支持连续订阅');
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
        throw new BadRequestException(`缺少必填字段: ${field}`);
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
      throw new ConflictException('会员等级数字已存在，请换一个等级值');
    }
    throw err;
  }

  private handleDeleteError(err: unknown, notFoundMessage: string): never {
    if (err instanceof BadRequestException) throw err;
    const code = (err as { code?: string })?.code;
    if (code === 'P2025') {
      throw new NotFoundException(notFoundMessage);
    }
    if (code === 'P2003') {
      throw new BadRequestException('该配置已被业务数据引用，不能直接删除');
    }
    throw err;
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

  private nullableDecimal(value: unknown, field: string) {
    if (value === null || value === undefined || value === '') return null;
    return this.nonNegativeDecimal(value, field);
  }

  private boolean(value: unknown, field: string) {
    if (typeof value !== 'boolean') {
      throw new BadRequestException(`${field} 必须为布尔值`);
    }
    return value;
  }

  private billingCycle(value: unknown) {
    if (!Object.values(BillingCycle).includes(value as BillingCycle)) {
      throw new BadRequestException('billingCycle 不合法');
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
