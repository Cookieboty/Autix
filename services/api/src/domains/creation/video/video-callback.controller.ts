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

/** 旧路由（迁移期兼容）固定绑定的协议 —— 现网提交任务写死回调地址前，唯一的视频协议。 */
const LEGACY_CALLBACK_PROTOCOL_KEY = 'ark-video@v3';

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

  /**
   * @deprecated 迁移期兼容：已提交任务的 `callback_url` 写死在上游、无法追溯修改，
   * 删掉这条路由会让窗口内的回调全部 404（有轮询兜底不丢数据，但退化成 30s 延迟）。
   * 待存量 in-flight 任务（无新路径 callback_url 的旧任务）收敛完毕后删除。
   */
  @Post()
  async handleLegacyCallback(
    @Query('token') token: string | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    return handleVideoCallbackRequest({
      protocolKey: LEGACY_CALLBACK_PROTOCOL_KEY,
      token,
      body,
      config: this.config,
      generationFlow: this.generationFlow,
      logger: this.logger,
    });
  }
}
