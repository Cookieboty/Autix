import {
  Body,
  Controller,
  Logger,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VideoGenerationFlowService } from './video-generation-flow.service';

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
    // 鉴权：回调 URL 由服务端携带 VIDEO_CALLBACK_SECRET 下发，校验 token 拒绝伪造来源。
    // 未配置 secret 时降级放行（与 APP_PUBLIC_URL 缺省时依赖 cron 的策略一致）。
    const secret = this.config.get<string>('VIDEO_CALLBACK_SECRET');
    if (secret && token !== secret) {
      this.logger.warn('Rejected video callback: invalid or missing token');
      throw new UnauthorizedException();
    }

    const taskId = body.id as string | undefined;
    if (!taskId) {
      this.logger.warn('Callback received without task id');
      return { received: true };
    }

    this.logger.log(`Seedance callback received: taskId=${taskId} status=${body.status}`);

    try {
      await this.generationFlow.handleCallback(taskId, body);
    } catch (err) {
      this.logger.error(
        `Callback processing failed: taskId=${taskId} ${String(err instanceof Error ? err.message : err)}`,
      );
    }

    return { received: true };
  }
}
