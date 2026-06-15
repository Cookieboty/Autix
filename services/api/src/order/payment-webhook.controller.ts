import {
  Body,
  Controller,
  Headers,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import { Public } from '../auth/decorators/public.decorator';
import { OrderService } from './order.service';

@Controller('payments/webhooks')
export class PaymentWebhookController {
  constructor(
    private readonly config: ConfigService,
    private readonly orderService: OrderService,
  ) {}

  @Post(':provider')
  @Public()
  async handleWebhook(
    @Param('provider') provider: string,
    @Headers('x-amux-payment-secret') secretHeader: string | undefined,
    @Headers('authorization') authorization: string | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    this.assertWebhookSecret(secretHeader, authorization);
    const eventId = this.stringValue(body.eventId ?? body.id ?? body.event_id);
    const eventType = this.stringValue(body.eventType ?? body.type ?? body.event_type);
    if (!eventId || !eventType) {
      throw new UnauthorizedException('Invalid payment webhook payload');
    }

    return this.orderService.handlePaymentWebhook({
      provider,
      eventId,
      eventType,
      status: this.stringValue(body.status ?? body.trade_status),
      orderId: this.stringValue(body.orderId ?? body.order_id),
      orderNo: this.stringValue(body.orderNo ?? body.order_no ?? body.out_trade_no),
      externalPaymentId: this.stringValue(
        body.externalPaymentId ?? body.paymentId ?? body.trade_no ?? body.transaction_id,
      ),
      amount: this.numberLikeValue(body.amount ?? body.paidAmount ?? body.total_amount),
      currency: this.stringValue(body.currency) ?? 'CNY',
      payload: body,
    });
  }

  private assertWebhookSecret(secretHeader?: string, authorization?: string) {
    const expected = this.config.get<string>('PAYMENT_WEBHOOK_SECRET');
    if (!expected) {
      throw new UnauthorizedException('Payment webhook secret is not configured');
    }

    const bearer = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (
      (secretHeader && this.safeCompare(secretHeader, expected)) ||
      (bearer && this.safeCompare(bearer, expected))
    ) {
      return;
    }
    throw new UnauthorizedException();
  }

  private safeCompare(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }

  private stringValue(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  private numberLikeValue(value: unknown) {
    if (typeof value === 'number' || typeof value === 'string') return value;
    if (typeof value === 'bigint') return value.toString();
    if (
      value &&
      typeof value === 'object' &&
      typeof (value as { toString?: unknown }).toString === 'function'
    ) {
      const serialized = (value as { toString: () => string }).toString();
      return serialized && serialized !== '[object Object]' ? serialized : undefined;
    }
    return undefined;
  }
}
