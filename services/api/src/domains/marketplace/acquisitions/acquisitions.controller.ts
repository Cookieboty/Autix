import {
  BadRequestException,
  Body,
  Controller,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ResourceType } from '../../platform/prisma/generated';
import { JwtAuthGuard } from '../../identity/auth/jwt-auth.guard';
import { CurrentUser, getCurrentUserId } from '../../identity/auth/decorators/current-user.decorator';
import { AcquisitionsService } from './acquisitions.service';
import type { AuthUser } from '@autix/types';

const TYPE_MAP: Record<string, ResourceType> = {
  skills: ResourceType.SKILL,
  mcp: ResourceType.MCP,
  agents: ResourceType.AGENT,
};

@UseGuards(JwtAuthGuard)
@Controller('marketplace')
export class AcquisitionsController {
  constructor(private readonly service: AcquisitionsService) {}

  @Post(':type/:id/acquire')
  acquire(
    @CurrentUser() user: AuthUser,
    @Param('type') typeStr: string,
    @Param('id') resourceId: string,
  ) {
    const userId = getCurrentUserId(user);
    const type = TYPE_MAP[typeStr];
    if (!type) {
      throw new BadRequestException(
        `资源类型 ${typeStr} 不支持获取(仅 skills/mcp/agents)`,
      );
    }
    return this.service.acquire(userId, type, resourceId);
  }
}
