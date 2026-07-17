import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class VideoCallbackUrlBuilder {
  constructor(private readonly config: ConfigService) {}

  /**
   * @param protocolKey 提交时已解析的协议 key（如 'ark-video@v3'）。编进回调路径，
   * 解决「要解析回调体得先知道 preset，要查 preset 得先解析回调体」的先有鸡先有蛋——
   * 提交时我们已知 preset，直接把它写进 URL。preset key 含 '@'，必须 URL 编码。
   */
  build(protocolKey: string): string | undefined {
    const base = this.config.get<string>('APP_PUBLIC_URL');
    if (!base) return undefined;

    const trimmed = base.replace(/\/+$/, '');
    const secret = this.config.get<string>('VIDEO_CALLBACK_SECRET');
    const suffix = secret ? `?token=${encodeURIComponent(secret)}` : '';
    return `${trimmed}/api/video/callback/${encodeURIComponent(protocolKey)}${suffix}`;
  }
}
