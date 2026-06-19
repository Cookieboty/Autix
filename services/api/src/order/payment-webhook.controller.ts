import {
  Body,
  Controller,
  Headers,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { OrderService } from './order.service';
import { StripePaymentService } from './stripe-payment.service';
import { handlePaymentWebhookRequest } from './payment-webhook.handler';

@Controller('payments/webhooks')
export class PaymentWebhookController {
  constructor(
    private readonly config: ConfigService,
    private readonly orderService: OrderService,
    private readonly stripePaymentService: StripePaymentService,
  ) {}

  @Post(':provider')
  @Public()
  async handleWebhook(
    @Param('provider') provider: string,
    @Headers('x-amux-payment-secret') secretHeader: string | undefined,
    @Headers('authorization') authorization: string | undefined,
    @Headers('stripe-signature') stripeSignature: string | undefined,
    @Req() req: Request & { rawBody?: Buffer },
    @Body() body: Record<string, unknown>,
  ) {
    return handlePaymentWebhookRequest({
      provider,
      secretHeader,
      authorization,
      stripeSignature,
      rawBody: req.rawBody,
      body,
      config: this.config,
      orderService: this.orderService,
      stripePaymentService: this.stripePaymentService,
    });
  }
}
