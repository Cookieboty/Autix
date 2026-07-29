import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@autix/domain';
import type {
  ChatDashboardBillingSummary,
  ChatDashboardContentPulse,
  ChatDashboardGenerationHealth,
  ChatDashboardPendingInbox,
  ChatDashboardRangeQuery,
  ChatDashboardRiskSignals,
} from '@autix/domain/admin/chat-dashboard';
import { AdminGuard } from '../../identity/auth/admin.guard';
import { CurrentUser } from '../../identity/auth/decorators/current-user.decorator';
import { Permissions } from '../../identity/auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../../identity/auth/guards/permissions.guard';
import { JwtAuthGuard } from '../../identity/auth/jwt-auth.guard';
import { ChatDashboardService } from './chat-dashboard.service';
import { ChatDashboardRangeQueryDto } from './dto/chat-dashboard-query.dto';

@Controller('admin/chat-dashboard')
@UseGuards(JwtAuthGuard, AdminGuard, PermissionsGuard)
@Permissions('chat-dashboard:read')
export class ChatDashboardController {
  constructor(private readonly service: ChatDashboardService) {}

  @Get('pending-inbox')
  pendingInbox(
    @CurrentUser() user: AuthUser,
  ): Promise<ChatDashboardPendingInbox> {
    return this.service.pendingInbox(user);
  }

  @Get('generation-health')
  generationHealth(
    @CurrentUser() user: AuthUser,
    @Query() query: ChatDashboardRangeQueryDto,
  ): Promise<ChatDashboardGenerationHealth> {
    return this.service.generationHealth(user, query as ChatDashboardRangeQuery);
  }

  @Get('billing-summary')
  billingSummary(
    @CurrentUser() user: AuthUser,
    @Query() query: ChatDashboardRangeQueryDto,
  ): Promise<ChatDashboardBillingSummary> {
    return this.service.billingSummary(user, query as ChatDashboardRangeQuery);
  }

  @Get('content-pulse')
  contentPulse(
    @CurrentUser() user: AuthUser,
    @Query() query: ChatDashboardRangeQueryDto,
  ): Promise<ChatDashboardContentPulse> {
    return this.service.contentPulse(user, query as ChatDashboardRangeQuery);
  }

  @Get('risk-signals')
  riskSignals(
    @CurrentUser() user: AuthUser,
    @Query() query: ChatDashboardRangeQueryDto,
  ): Promise<ChatDashboardRiskSignals> {
    return this.service.riskSignals(user, query as ChatDashboardRangeQuery);
  }
}
