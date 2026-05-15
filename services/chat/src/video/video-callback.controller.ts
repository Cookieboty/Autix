import { Body, Controller, HttpCode, HttpStatus, Logger, Post } from '@nestjs/common';
import { VideoGenerationFlowService } from './video-generation-flow.service';

@Controller('video/callback')
export class VideoCallbackController {
  private readonly logger = new Logger(VideoCallbackController.name);

  constructor(
    private readonly generationFlow: VideoGenerationFlowService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async handleCallback(@Body() body: Record<string, unknown>) {
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
