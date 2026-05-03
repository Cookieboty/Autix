import {
  BadRequestException,
  Body,
  Controller,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { ResourceType } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AcquisitionsService } from './acquisitions.service';

const TYPE_MAP: Record<string, ResourceType> = {
  skills: ResourceType.SKILL,
  mcp: ResourceType.MCP,
  agents: ResourceType.AGENT,
};

@UseGuards(JwtAuthGuard)
@Controller('api/marketplace')
export class AcquisitionsController {
  constructor(private readonly service: AcquisitionsService) {}

  @Post(':type/:id/acquire')
  acquire(
    @Req() req: Request,
    @Param('type') typeStr: string,
    @Param('id') resourceId: string,
  ) {
    const userId = (req.user as { userId: string }).userId;
    const type = TYPE_MAP[typeStr];
    if (!type) {
      throw new BadRequestException(
        `资源类型 ${typeStr} 不支持获取(仅 skills/mcp/agents)`,
      );
    }
    return this.service.acquire(userId, type, resourceId);
  }
}
