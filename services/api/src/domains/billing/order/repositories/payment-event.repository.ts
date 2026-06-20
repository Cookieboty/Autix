import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../platform/prisma/prisma.service';
import { Prisma, type payment_events } from '../../../platform/prisma/generated';

type PaymentWebhookInput = {
  provider: string;
  eventId: string;
  eventType: string;
  status?: string;
  orderId?: string;
  orderNo?: string;
  externalPaymentId?: string;
  amount?: Prisma.Decimal | number | string | null;
  currency?: string;
  payload?: unknown;
};

type PaymentEventClaim = {
  event: payment_events;
  alreadyProcessed?: boolean;
  alreadyProcessing?: boolean;
};

const PROCESSING_STALE_MINUTES = 10;

@Injectable()
export class PaymentEventRepository {
  constructor(private readonly prisma: PrismaService) {}

  async recoverStaleProcessingEvents(): Promise<number> {
    const threshold = new Date(
      Date.now() - PROCESSING_STALE_MINUTES * 60 * 1000,
    );
    const result = await this.prisma.payment_events.updateMany({
      where: {
        status: 'PROCESSING',
        processedAt: null,
        updatedAt: { lt: threshold },
      },
      data: {
        status: 'PENDING',
        errorMessage: `auto-recovered: stuck in PROCESSING for >${PROCESSING_STALE_MINUTES}min`,
      },
    });
    return result.count;
  }

  async claimPaymentEvent(input: PaymentWebhookInput): Promise<PaymentEventClaim> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.payment_events.findUnique({
          where: { provider_eventId: { provider: input.provider, eventId: input.eventId } },
        });
        if (existing?.processedAt) {
          return { event: existing, alreadyProcessed: true };
        }

        if (existing) {
          const staleThreshold = new Date(
            Date.now() - PROCESSING_STALE_MINUTES * 60 * 1000,
          );
          const claimed = await tx.payment_events.updateMany({
            where: {
              id: existing.id,
              processedAt: null,
              OR: [
                { status: { not: 'PROCESSING' } },
                { updatedAt: { lt: staleThreshold } },
              ],
            },
            data: {
              eventType: input.eventType,
              orderNo: input.orderNo,
              externalPaymentId: input.externalPaymentId,
              amount: this.optionalDecimal(input.amount),
              currency: input.currency,
              status: 'PROCESSING',
              payload: this.toJsonInput(input.payload),
              errorMessage: null,
            },
          });
          if (claimed.count === 0) {
            return { event: existing, alreadyProcessing: true };
          }
          const event = await tx.payment_events.findUnique({ where: { id: existing.id } });
          if (!event) throw new NotFoundException('支付事件不存在');
          return { event, alreadyProcessed: false };
        }

        const event = await tx.payment_events.create({
          data: {
            provider: input.provider,
            eventId: input.eventId,
            eventType: input.eventType,
            orderNo: input.orderNo,
            externalPaymentId: input.externalPaymentId,
            amount: this.optionalDecimal(input.amount),
            currency: input.currency,
            status: 'PROCESSING',
            payload: this.toJsonInput(input.payload),
          },
        });
        return { event, alreadyProcessed: false };
      });
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2002') {
        return this.claimPaymentEvent(input);
      }
      throw error;
    }
  }

  async markProcessedWithinTx(
    tx: Prisma.TransactionClient,
    eventId: string,
    data: { orderId: string; userId: string; orderNo: string },
  ): Promise<payment_events> {
    return tx.payment_events.update({
      where: { id: eventId },
      data: {
        orderId: data.orderId,
        userId: data.userId,
        orderNo: data.orderNo,
        status: 'PROCESSED',
        processedAt: new Date(),
      },
    });
  }

  async markIgnoredWithinTx(
    tx: Prisma.TransactionClient,
    eventId: string,
  ): Promise<payment_events> {
    return tx.payment_events.update({
      where: { id: eventId },
      data: { status: 'IGNORED', processedAt: new Date() },
    });
  }

  async markFailed(eventId: string, errorMessage: string): Promise<void> {
    await this.prisma.payment_events
      .update({
        where: { id: eventId },
        data: {
          status: 'FAILED',
          errorMessage,
        },
      })
      .catch(() => undefined);
  }

  async findByIdWithinTx(
    tx: Prisma.TransactionClient,
    id: string,
  ): Promise<payment_events | null> {
    return tx.payment_events.findUnique({ where: { id } });
  }

  async upsertRefundEventWithinTx(
    tx: Prisma.TransactionClient,
    data: {
      provider: string;
      externalRefundId: string;
      orderId: string;
      userId: string;
      orderNo: string;
      externalPaymentId: string | null;
      amount: Prisma.Decimal;
      currency: string;
      metadata?: unknown;
    },
  ): Promise<payment_events> {
    return tx.payment_events.upsert({
      where: {
        provider_eventId: {
          provider: data.provider,
          eventId: `refund:${data.externalRefundId}`,
        },
      },
      create: {
        provider: data.provider,
        eventId: `refund:${data.externalRefundId}`,
        eventType: 'refund.succeeded',
        orderId: data.orderId,
        userId: data.userId,
        orderNo: data.orderNo,
        externalPaymentId: data.externalPaymentId,
        amount: data.amount,
        currency: data.currency,
        status: 'PROCESSED',
        payload: this.toJsonInput(data.metadata),
        processedAt: new Date(),
      },
      update: {
        orderId: data.orderId,
        userId: data.userId,
        status: 'PROCESSED',
        payload: this.toJsonInput(data.metadata),
        processedAt: new Date(),
      },
    });
  }

  private optionalDecimal(value?: Prisma.Decimal | number | string | null) {
    if (value === undefined || value === null || value === '') return undefined;
    return new Prisma.Decimal(value);
  }

  private toJsonInput(value: unknown): Prisma.InputJsonValue | undefined {
    if (value === undefined || value === null) return undefined;
    return value as Prisma.InputJsonValue;
  }
}
