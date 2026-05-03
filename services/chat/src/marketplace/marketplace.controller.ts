import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MarketplaceService } from './marketplace.service';

@UseGuards(JwtAuthGuard)
@Controller('api/marketplace')
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
@Controller('api/me')
export class MeController {
  constructor(private readonly service: MarketplaceService) {}

  @Get('resources')
  myResources(
    @Req() req: Request,
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
    const userId = (req.user as { userId: string }).userId;
    return this.service.getMyResources(userId, tab, {
      page: page ? +page : undefined,
      pageSize: pageSize ? +pageSize : undefined,
    });
  }
}
