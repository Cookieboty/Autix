import {
  Body,
  Controller,
  Logger,
  Post,
  Query,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VideoGenerationFlowService } from './video-generation-flow.service';
import { handleVideoCallbackRequest } from './video-callback.handler';

@Controller('video/callback')
export class VideoCallbackController {
  private readonly logger = new Logger(VideoCallbackController.name);

  constructor(
    private readonly generationFlow: VideoGenerationFlowService,
    private readonly config: ConfigService,
  ) {}

  @Post()
  async handleCallback(
    @Query('token') token: string | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    return handleVideoCallbackRequest({
      token,
      body,
      config: this.config,
      generationFlow: this.generationFlow,
      logger: this.logger,
    });
  }
}
