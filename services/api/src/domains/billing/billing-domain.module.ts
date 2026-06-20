import { Module } from '@nestjs/common';
import { CampaignModule } from './campaign/campaign.module';
import { InviteModule } from './invite/invite.module';
import { MembershipModule } from './membership/membership.module';
import { OrderModule } from './order/order.module';
import { PointsModule } from './points/points.module';

@Module({
  imports: [MembershipModule, PointsModule, OrderModule, CampaignModule, InviteModule],
  exports: [MembershipModule, PointsModule, OrderModule, CampaignModule, InviteModule],
})
export class BillingDomainModule {}
