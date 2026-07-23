import { BadRequestException, HttpStatus } from '@nestjs/common';
import {
  PointGrantType,
  Prisma,
} from '../../platform/prisma/generated';
import { I18nHttpException } from '../../platform/i18n/i18n-http.exception';
import type {
  FulfillOrderDto,
  GrantPointsDto,
  RefundOrderDto,
} from './dto/admin-write.dto';
import type { RefundOrderInput } from '../../billing/order/services/order-refund.helpers';

export interface AdminPagination {
  page: number;
  pageSize: number;
}

export interface AdminAuditRecordInput {
  action: string;
  actorId: string;
  at: string;
  payload: Record<string, unknown>;
}

export function parseAdminInt(value: string | undefined, fallback: number) {
  return parseInt(value ?? String(fallback), 10) || fallback;
}

export function normalizeAdminPagination(
  page = '1',
  pageSize = '20',
): AdminPagination {
  return {
    page: parseAdminInt(page, 1),
    pageSize: parseAdminInt(pageSize, 20),
  };
}

export function normalizeAuditLogQuery(input: {
  action?: string;
  actorId?: string;
  limit?: string;
  cursor?: string;
}) {
  return {
    action: input.action,
    actorId: input.actorId,
    limit: parseAdminInt(input.limit, 50),
    cursor: input.cursor ? parseInt(input.cursor, 10) || undefined : undefined,
  };
}

export function normalizeOrderListQuery(input: {
  page?: string;
  pageSize?: string;
  userId?: string;
  status?: string;
  orderType?: string;
}) {
  return {
    ...normalizeAdminPagination(input.page ?? '1', input.pageSize ?? '20'),
    userId: input.userId,
    status: input.status,
    orderType: input.orderType,
  };
}

export function normalizePointsRecordsQuery(input: {
  page?: string;
  pageSize?: string;
  userId?: string;
  source?: string;
}) {
  return {
    ...normalizeAdminPagination(input.page ?? '1', input.pageSize ?? '20'),
    userId: input.userId,
    source: input.source,
  };
}

export function normalizeUserSummariesQuery(
  page = '1',
  pageSize = '20',
  search = '',
) {
  return {
    ...normalizeAdminPagination(page, pageSize),
    search,
  };
}

export function normalizeUserPointsDetailLimits(
  grantTake = '50',
  holdTake = '20',
  recordTake = '50',
) {
  return {
    grantLimit: boundAdminLimit(grantTake, 50, 200),
    holdLimit: boundAdminLimit(holdTake, 20, 100),
    recordLimit: boundAdminLimit(recordTake, 50, 200),
  };
}

export function buildPointsPackageCreateData(
  input: Record<string, unknown>,
): Prisma.points_packagesUncheckedCreateInput {
  return buildPointsPackageWriteData(input, [
    'name',
    'price',
    'points',
  ]) as Prisma.points_packagesUncheckedCreateInput;
}

export function buildPointsPackageWriteData(
  input: Record<string, unknown>,
  required: string[] = [],
): Prisma.points_packagesUncheckedUpdateInput {
  assertRequired(input, required);
  const data: Prisma.points_packagesUncheckedUpdateInput = {};

  if (has(input, 'code')) data.code = nullableString(input.code, 'code');
  if (has(input, 'name')) data.name = requiredString(input.name, 'name');
  if (has(input, 'description')) {
    data.description = nullableString(input.description, 'description');
  }
  if (has(input, 'price')) data.price = nonNegativeDecimal(input.price, 'price');
  if (has(input, 'points')) data.points = positiveInt(input.points, 'points');
  if (has(input, 'validityDays')) {
    data.validityDays = positiveInt(input.validityDays, 'validityDays');
  }
  if (has(input, 'usageScope')) data.usageScope = toNullableJson(input.usageScope);
  if (has(input, 'showCommercialLicense')) {
    data.showCommercialLicense = boolean(
      input.showCommercialLicense,
      'showCommercialLicense',
    );
  }
  if (has(input, 'isActive')) data.isActive = boolean(input.isActive, 'isActive');
  if (has(input, 'sort')) data.sort = nonNegativeInt(input.sort, 'sort');

  return data;
}

export function pickAuditPayload<T extends object>(
  input: T,
  fields: readonly (keyof T & string)[],
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const field of fields) {
    payload[field] = input[field];
  }
  return payload;
}

export function idAuditPayload(
  id: string,
  extra: Record<string, unknown> = {},
) {
  return { id, ...extra };
}

export function buildFulfillOrderAuditPayload(
  id: string,
  body: FulfillOrderDto,
) {
  return {
    id,
    externalPaymentId: body.externalPaymentId,
    amount: body.amount,
  };
}

export function buildManualPaymentInput(
  operatorId: string,
  body: FulfillOrderDto,
) {
  return {
    operatorId,
    externalPaymentId: body.externalPaymentId,
    amount: body.amount,
    currency: body.currency,
    remark: body.remark,
  };
}

export function buildRefundOrderAuditPayload(id: string, body: RefundOrderDto) {
  return {
    id,
    amount: body.amount,
    reclaimPoints: body.reclaimPoints,
    reason: body.reason,
  };
}

export function buildRefundOrderInput(operatorId: string, body: RefundOrderDto) {
  return {
    provider: 'admin_manual',
    externalRefundId: body.externalRefundId,
    amount: body.amount,
    currency: body.currency,
    reclaimPoints: body.reclaimPoints,
    maxPointsToReclaim: body.maxPointsToReclaim,
    reason: body.reason ?? body.remark ?? 'admin refund',
    metadata: {
      operatorId,
      remark: body.remark,
    },
  };
}

export function mergeRefundProviderInput(
  input: RefundOrderInput,
  providerRefund: {
    provider: string;
    externalRefundId: string;
    amount: string | number;
    currency: string;
    metadata?: unknown;
  },
): RefundOrderInput {
  return {
    ...input,
    provider: providerRefund.provider,
    externalRefundId: providerRefund.externalRefundId,
    amount: providerRefund.amount,
    currency: providerRefund.currency,
    metadata: {
      ...(input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata)
        ? input.metadata
        : {}),
      providerRefund: providerRefund.metadata,
    },
  };
}

export function buildGrantPointsDecision(
  body: GrantPointsDto,
  pointsPackage?: { name: string; points: number } | null,
) {
  if (body.packageId) {
    if (!pointsPackage) {
      throw new I18nHttpException(
        HttpStatus.BAD_REQUEST,
        'grant.points_package_not_found',
      );
    }
    return {
      pointsToGrant: pointsPackage.points,
      remark: body.remark || `Admin granted points package: ${pointsPackage.name}`,
      grantType: PointGrantType.PURCHASED,
    };
  }

  if (body.points && body.points > 0) {
    return {
      pointsToGrant: body.points,
      remark: body.remark || 'Admin manual points grant',
      grantType: PointGrantType.COMPENSATION,
    };
  }

  throw new I18nHttpException(
    HttpStatus.BAD_REQUEST,
    'grant.missing_points_or_package',
  );
}

export function buildAdminAuditRecord(
  actorId: string,
  action: string,
  payload: Record<string, unknown>,
  at: Date = new Date(),
): AdminAuditRecordInput {
  return {
    action,
    actorId,
    at: at.toISOString(),
    payload,
  };
}

function boundAdminLimit(value: string, fallback: number, max: number) {
  return Math.min(Math.max(parseAdminInt(value, fallback), 1), max);
}

function assertRequired(input: Record<string, unknown>, fields: string[]) {
  for (const field of fields) {
    if (
      !has(input, field) ||
      input[field] === undefined ||
      input[field] === null ||
      input[field] === ''
    ) {
      throw new BadRequestException(`Missing required field: ${field}`);
    }
  }
}

function has(input: Record<string, unknown>, field: string) {
  return Object.prototype.hasOwnProperty.call(input, field);
}

function requiredString(value: unknown, field: string) {
  if (typeof value !== 'string') {
    throw new BadRequestException(`${field} must be a string`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new BadRequestException(`${field} must not be empty`);
  }
  return trimmed;
}

function nullableString(value: unknown, field: string) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') {
    throw new BadRequestException(`${field} must be a string`);
  }
  const trimmed = value.trim();
  return trimmed || null;
}

function nonNegativeInt(value: unknown, field: string) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) {
    throw new BadRequestException(`${field} must be a non-negative integer`);
  }
  return n;
}

function positiveInt(value: unknown, field: string) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    throw new BadRequestException(`${field} must be a positive integer`);
  }
  return n;
}

function nonNegativeDecimal(value: unknown, field: string) {
  if (value === null || value === undefined || value === '') {
    throw new BadRequestException(`${field} must not be empty`);
  }
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new BadRequestException(`${field} must be a monetary amount`);
  }
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw new BadRequestException(`${field} must be a non-negative amount`);
  }
  return typeof value === 'string' ? value.trim() : value;
}

function boolean(value: unknown, field: string) {
  if (typeof value !== 'boolean') {
    throw new BadRequestException(`${field} must be a boolean`);
  }
  return value;
}

function toNullableJson(
  value: unknown,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  if (value === null || value === undefined || value === '') return Prisma.JsonNull;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
