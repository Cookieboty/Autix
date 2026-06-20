import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../identity/auth/jwt-auth.guard';
import { CurrentUser, getCurrentUserId } from '../../identity/auth/decorators/current-user.decorator';
import { VideoMaterialService } from './video-material.service';
import type { AuthUser } from '@autix/types';

@UseGuards(JwtAuthGuard)
@Controller('video/materials')
export class VideoMaterialController {
  constructor(private readonly materialService: VideoMaterialService) {}

  @Get('from-image-generations')
  getFromImageGenerations(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('conversationId') conversationId?: string,
  ) {
    const userId = getCurrentUserId(user);
    return this.materialService.getImageGenerationProducts(userId, {
      page: page ? +page : undefined,
      pageSize: pageSize ? +pageSize : undefined,
      conversationId,
    });
  }

  @Get('from-video-generations')
  getFromVideoGenerations(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const userId = getCurrentUserId(user);
    return this.materialService.getVideoGenerationProducts(userId, {
      page: page ? +page : undefined,
      pageSize: pageSize ? +pageSize : undefined,
    });
  }

  @Post('upload')
  createUploadUrl(
    @Body() body: { fileName: string; contentType: string; folder?: string },
  ) {
    return this.materialService.createPresignedUpload(body);
  }
}
