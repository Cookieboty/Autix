import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { VideoMaterialService } from './video-material.service';

@UseGuards(JwtAuthGuard)
@Controller('video/materials')
export class VideoMaterialController {
  constructor(private readonly materialService: VideoMaterialService) {}

  @Get('from-image-generations')
  getFromImageGenerations(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('conversationId') conversationId?: string,
  ) {
    const userId = (req.user as { userId: string }).userId;
    return this.materialService.getImageGenerationProducts(userId, {
      page: page ? +page : undefined,
      pageSize: pageSize ? +pageSize : undefined,
      conversationId,
    });
  }

  @Get('from-video-generations')
  getFromVideoGenerations(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const userId = (req.user as { userId: string }).userId;
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
