import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  PublicCollectionKind,
  PublicCreationMediaType,
  PublicPromptVisibility,
} from '../../platform/prisma/generated';
import { JwtAuthGuard } from '../../identity/auth/jwt-auth.guard';
import {
  CurrentUser,
  OptionalCurrentUser,
  getCurrentUserId,
} from '../../identity/auth/decorators/current-user.decorator';
import { Public } from '../../identity/auth/decorators/public.decorator';
import type { AuthUser } from '@autix/domain';
import { PublicGrowthService } from './public-growth.service';

interface PublishBody {
  title?: string;
  description?: string;
  tags?: string[];
  promptVisibility?: PublicPromptVisibility;
  collectionSlug?: string;
}

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
  @Get('creations')
  listCreations(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('mediaType') mediaType?: PublicCreationMediaType,
    @Query('tag') tag?: string,
    @Query('collectionSlug') collectionSlug?: string,
  ) {
    return this.service.listCreations({
      page: page ? +page : undefined,
      pageSize: pageSize ? +pageSize : undefined,
      mediaType,
      tag,
      collectionSlug,
    });
  }

  @Public()
  @Get('creations/:id')
  getCreation(@Param('id') id: string) {
    return this.service.getCreation(id);
  }

  @Public()
  @Post('creations/:id/view')
  recordView(@Param('id') id: string) {
    return this.service.recordView(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('creations/:id/like')
  likeCreation(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.likeCreation(id, getCurrentUserId(user));
  }

  @Public()
  @Post('creations/:id/share')
  recordShare(@Param('id') id: string) {
    return this.service.recordShare(id);
  }

  @Public()
  @Get('creators/:handle')
  getCreator(@Param('handle') handle: string) {
    return this.service.getCreator(handle);
  }

  @Public()
  @Get('creators/:handle/creations')
  getCreatorCreations(
    @Param('handle') handle: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.getCreatorCreations(handle, {
      page: page ? +page : undefined,
      pageSize: pageSize ? +pageSize : undefined,
    });
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

@UseGuards(JwtAuthGuard)
@Controller()
export class PublicGrowthPublishController {
  constructor(private readonly service: PublicGrowthService) {}

  @Post('generations/image/:id/publish')
  publishImageGeneration(
    @CurrentUser() user: AuthUser,
    @Param('id') generationId: string,
    @Body() body: PublishBody,
  ) {
    return this.service.publishImageGeneration(
      generationId,
      getCurrentUserId(user),
      body,
    );
  }

  @Post('video-projects/:id/publish')
  publishVideoProject(
    @CurrentUser() user: AuthUser,
    @Param('id') projectId: string,
    @Body() body: PublishBody,
  ) {
    return this.service.publishVideoProject(
      projectId,
      getCurrentUserId(user),
      body,
    );
  }
}
