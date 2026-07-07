import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { PublicCollectionKind } from '../../platform/prisma/generated';
import { JwtAuthGuard } from '../../identity/auth/jwt-auth.guard';
import {
  CurrentUser,
  OptionalCurrentUser,
  getCurrentUserId,
} from '../../identity/auth/decorators/current-user.decorator';
import { Public } from '../../identity/auth/decorators/public.decorator';
import type { AuthUser } from '@autix/domain';
import { PublicGrowthService } from './public-growth.service';

@Controller('public')
export class PublicGrowthController {
  constructor(private readonly service: PublicGrowthService) {}

  @Public()
  @Get('home')
  getHome(@Query('locale') locale?: string) {
    return this.service.getHome(locale);
  }

  @Public()
  @Get('pages/:slug')
  getPage(@Param('slug') slug: string, @Query('locale') locale?: string) {
    return this.service.getPage(slug, locale);
  }

  @Public()
  @Get('collections')
  listCollections(
    @Query('kind') kind?: PublicCollectionKind,
    @Query('locale') locale?: string,
  ) {
    return this.service.listCollections(kind, locale);
  }

  @Public()
  @Get('collections/:slug')
  getCollection(@Param('slug') slug: string, @Query('locale') locale?: string) {
    return this.service.getCollection(slug, locale);
  }

  @Public()
  @Get('creators/:handle')
  getCreator(@Param('handle') handle: string) {
    return this.service.getCreator(handle);
  }

  @UseGuards(JwtAuthGuard)
  @Post('creators/:handle/follow')
  followCreator(@CurrentUser() user: AuthUser, @Param('handle') handle: string) {
    return this.service.followCreator(handle, getCurrentUserId(user));
  }

  @Public()
  @Post('events')
  recordEvent(
    @OptionalCurrentUser() user: AuthUser | undefined,
    @Body()
    body: {
      eventName?: string;
      path?: string;
      anonymousId?: string;
      source?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    return this.service.recordEvent({
      ...body,
      userId: user?.id,
    });
  }
}
