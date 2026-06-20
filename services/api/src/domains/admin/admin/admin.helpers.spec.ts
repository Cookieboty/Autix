import { BadRequestException } from '@nestjs/common';
import {
  PointGrantType,
  Prisma,
} from '../../platform/prisma/generated';
import {
  buildAdminAuditRecord,
  buildGrantPointsDecision,
  buildManualPaymentInput,
  buildPointsPackageCreateData,
  buildPointsPackageWriteData,
  buildRefundOrderInput,
  normalizeAdminPagination,
  normalizeAuditLogQuery,
  normalizeOrderListQuery,
  normalizeUserPointsDetailLimits,
  pickAuditPayload,
} from './admin.helpers';

describe('admin helpers', () => {
  describe('pagination and limits', () => {
    it('keeps the existing loose parseInt fallback semantics', () => {
      expect(normalizeAdminPagination('2abc', '0')).toEqual({
        page: 2,
        pageSize: 20,
      });
      expect(normalizeAdminPagination('-3', '15')).toEqual({
        page: -3,
        pageSize: 15,
      });
      expect(normalizeOrderListQuery({
        page: 'bad',
        pageSize: '30',
        userId: 'user-1',
        status: 'PAID',
        orderType: 'POINTS_PACKAGE',
      })).toEqual({
        page: 1,
        pageSize: 30,
        userId: 'user-1',
        status: 'PAID',
        orderType: 'POINTS_PACKAGE',
      });
    });

    it('normalizes audit cursor and bounded points-detail limits', () => {
      expect(normalizeAuditLogQuery({
        action: 'users.approve',
        actorId: 'admin-1',
        limit: '0',
        cursor: '42',
      })).toEqual({
        action: 'users.approve',
        actorId: 'admin-1',
        limit: 50,
        cursor: 42,
      });
      expect(normalizeAuditLogQuery({ cursor: 'abc' }).cursor).toBeUndefined();

      expect(normalizeUserPointsDetailLimits('500', '0', '-5')).toEqual({
        grantLimit: 200,
        holdLimit: 20,
        recordLimit: 1,
      });
    });
  });

  describe('points package write data', () => {
    it('builds create data with trimmed and nullable fields', () => {
      expect(buildPointsPackageCreateData({
        code: ' starter ',
        name: ' Starter Pack ',
        description: '',
        price: ' 9.90 ',
        points: '1000',
        validityDays: 180,
        usageScope: { allowedTaskTypes: [] },
        showCommercialLicense: true,
        isActive: false,
        sort: 10,
      })).toEqual({
        code: 'starter',
        name: 'Starter Pack',
        description: null,
        price: '9.90',
        points: 1000,
        validityDays: 180,
        usageScope: { allowedTaskTypes: [] },
        showCommercialLicense: true,
        isActive: false,
        sort: 10,
      });
    });

    it('supports partial update data and Prisma JsonNull', () => {
      expect(buildPointsPackageWriteData({
        code: '',
        description: null,
        usageScope: '',
      })).toEqual({
        code: null,
        description: null,
        usageScope: Prisma.JsonNull,
      });
    });

    it('rejects missing required fields and invalid scalar values', () => {
      expect(() => buildPointsPackageCreateData({
        name: 'Starter Pack',
        points: 100,
      })).toThrow(BadRequestException);
      expect(() => buildPointsPackageWriteData({ points: 0 })).toThrow(
        BadRequestException,
      );
      expect(() => buildPointsPackageWriteData({ price: -1 })).toThrow(
        BadRequestException,
      );
      expect(() => buildPointsPackageWriteData({ isActive: 'true' })).toThrow(
        BadRequestException,
      );
    });
  });

  describe('order and grant payloads', () => {
    it('builds manual payment and refund inputs without changing defaults', () => {
      expect(buildManualPaymentInput('admin-1', {
        externalPaymentId: 'pay-1',
        amount: '9.90',
        currency: 'USD',
        remark: 'paid offline',
      })).toEqual({
        operatorId: 'admin-1',
        externalPaymentId: 'pay-1',
        amount: '9.90',
        currency: 'USD',
        remark: 'paid offline',
      });

      expect(buildRefundOrderInput('admin-1', { remark: 'duplicate' })).toEqual({
        provider: 'admin_manual',
        externalRefundId: undefined,
        amount: undefined,
        currency: undefined,
        reclaimPoints: undefined,
        maxPointsToReclaim: undefined,
        reason: 'duplicate',
        metadata: {
          operatorId: 'admin-1',
          remark: 'duplicate',
        },
      });

      expect(buildRefundOrderInput('admin-1', {}).reason).toBe('admin refund');
    });

    it('decides grant-points package and manual branches', () => {
      expect(buildGrantPointsDecision(
        { packageId: 'pkg-1' },
        { name: 'Starter', points: 1000 },
      )).toEqual({
        pointsToGrant: 1000,
        remark: '管理员授予积分包: Starter',
        grantType: PointGrantType.PURCHASED,
      });

      expect(buildGrantPointsDecision({ points: 50, remark: 'thanks' })).toEqual({
        pointsToGrant: 50,
        remark: 'thanks',
        grantType: PointGrantType.COMPENSATION,
      });

      expect(() => buildGrantPointsDecision({ packageId: 'missing' }, null)).toThrow(
        BadRequestException,
      );
      expect(() => buildGrantPointsDecision({ points: 0 })).toThrow(
        BadRequestException,
      );
    });
  });

  describe('audit payloads', () => {
    it('picks explicit keys and builds serializable audit records', () => {
      expect(pickAuditPayload({ name: 'Starter', points: 100, ignored: true }, [
        'name',
        'points',
      ])).toEqual({ name: 'Starter', points: 100 });

      expect(buildAdminAuditRecord(
        'admin-1',
        'points_packages.create',
        { name: 'Starter' },
        new Date('2024-01-02T03:04:05.000Z'),
      )).toEqual({
        actorId: 'admin-1',
        action: 'points_packages.create',
        at: '2024-01-02T03:04:05.000Z',
        payload: { name: 'Starter' },
      });
    });
  });
});
