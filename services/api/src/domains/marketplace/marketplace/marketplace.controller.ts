import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../identity/auth/jwt-auth.guard';
import { CurrentUser, getCurrentUserId } from '../../identity/auth/decorators/current-user.decorator';
import { Public } from '../../identity/auth/decorators/public.decorator';
import { MarketplaceService } from './marketplace.service';
import type { AuthUser } from '@autix/types';

@Public()
@Controller('marketplace')
export class MarketplaceController {
  constructor(private readonly service: MarketplaceService) {}

  @Get('home')
  home() {
    return this.service.getHome();
  }

  @Get('hot-rankings')
  hotRankings(@Query('limit') limit?: string) {
    return this.service.getHotRankings(limit ? +limit : undefined);
  }

  @Get('editor-picks')
  editorPicks(@Query('limit') limit?: string) {
    return this.service.getEditorPicks(limit ? +limit : undefined);
  }

  @Get('platform-stats')
  platformStats() {
    return this.service.getPlatformStats();
  }
}

@UseGuards(JwtAuthGuard)
@Controller('me')
export class MeController {
  constructor(private readonly service: MarketplaceService) {}

  @Get('resources')
  myResources(
    @CurrentUser() user: AuthUser,
    @Query('tab')
    tab:
      | 'acquired'
      | 'favorites'
      | 'published'
      | 'history'
      | 'generations' = 'acquired',
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const userId = getCurrentUserId(user);
    return this.service.getMyResources(userId, tab, {
      page: page ? +page : undefined,
      pageSize: pageSize ? +pageSize : undefined,
    });
  }
}
