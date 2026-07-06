import { BadRequestException, Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Public } from '../../identity/auth/decorators/public.decorator';
import {
  ResourceViewPipelineService,
  type ResourceViewEventInput,
} from './resource-view.pipeline';

/**
 * 遥测上报入口：前端批量上报浏览事件，仅写明细表（insert-or-ignore），
 * 不同步更新计数器——计数器由 ResourceViewPipelineService.aggregateDaily 异步聚合。
 * 无需登录（匿名访客也要计 PV/UV），body 内每行独立校验，脏行直接丢弃不影响其余行。
 */
@Controller('telemetry')
export class TelemetryController {
  constructor(private readonly pipeline: ResourceViewPipelineService) {}

  @Public()
  @Post('resource-view')
  @HttpCode(HttpStatus.OK)
  async recordResourceViews(@Body() body: unknown) {
    if (!Array.isArray(body)) {
      throw new BadRequestException('body 必须是浏览事件数组');
    }
    return this.pipeline.ingest(body as ResourceViewEventInput[]);
  }
}
