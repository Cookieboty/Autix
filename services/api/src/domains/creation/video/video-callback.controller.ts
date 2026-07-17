import {
  Body,
  Controller,
  Logger,
  Param,
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

  /**
   * 新形态：protocolKey 编进路径，解决「要解析回调体得先知道 preset，
   * 要查 preset 得先解析回调体」的先有鸡先有蛋 —— 提交时我们已知 preset。
   */
  @Post(':protocolKey')
  async handleCallback(
    @Param('protocolKey') protocolKey: string,
    @Query('token') token: string | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    return handleVideoCallbackRequest({
      protocolKey,
      token,
      body,
      config: this.config,
      generationFlow: this.generationFlow,
      logger: this.logger,
    });
  }
}
