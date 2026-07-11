import { Body, Controller, Post, UsePipes, ValidationPipe } from '@nestjs/common';
import type { AuthUser } from '@autix/domain';
import {
  OptionalCurrentUser,
  getCurrentUserId,
} from '../../identity/auth/decorators/current-user.decorator';
import { Public } from '../../identity/auth/decorators/public.decorator';
import { MembershipService } from '../membership/membership.service';
import { EstimateTaskDto } from './dto/estimate-task.dto';
import { PointsService } from './points.service';

/**
 * `/points/estimate` 的会员感知实现。刻意放在 TasksModule（它 import 了 MembershipModule）
 * 里，而不是 PointsModule——PointsModule 不能 import MembershipModule，否则形成 5 模块 DI 环
 * （见 tasks.module.ts）。旧的 PointsController.estimateCost 不解析会员等级，导致界面按非会员
 * 价展示、hold 却按会员价扣费。这里按当前登录用户的会员等级估价，与真实扣费口径一致。
 */
@Controller('points')
export class PointsEstimateController {
  constructor(
    private readonly pointsService: PointsService,
    private readonly membershipService: MembershipService,
  ) {}

  @Post('estimate')
  @Public()
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async estimateCost(
    @Body() body: EstimateTaskDto,
    @OptionalCurrentUser() user: AuthUser | undefined,
  ) {
    const membershipLevel = user
      ? await this.membershipService.resolveActiveMembershipLevel(getCurrentUserId(user))
      : 0;
    return this.pointsService.estimateCost({ ...body, membershipLevel });
  }
}
