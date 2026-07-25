import {
  Controller,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ResourceType } from '../../platform/prisma/generated';
import { I18nHttpException } from '../../platform/i18n/i18n-http.exception';
import { JwtAuthGuard } from '../../identity/auth/jwt-auth.guard';
import { CurrentUser, getCurrentUserId } from '../../identity/auth/decorators/current-user.decorator';
import { AcquisitionsService } from './acquisitions.service';
import type { AuthUser } from '@autix/domain';

const TYPE_MAP: Record<string, ResourceType> = {
  skills: ResourceType.SKILL,
  mcp: ResourceType.MCP,
  agents: ResourceType.AGENT,
};

@UseGuards(JwtAuthGuard)
@Controller('marketplace')
export class AcquisitionsController {
  constructor(private readonly service: AcquisitionsService) { }

  @Post(':type/:id/acquire')
  acquire(
    @CurrentUser() user: AuthUser,
    @Param('type') typeStr: string,
    @Param('id') resourceId: string,
  ) {
    const userId = getCurrentUserId(user);
    const type = TYPE_MAP[typeStr];
    if (!type) {
      throw new I18nHttpException(
        HttpStatus.BAD_REQUEST,
        'acquisition.type_unsupported',
        { type: typeStr },
      );
    }
    return this.service.acquire(userId, type, resourceId);
  }
}
