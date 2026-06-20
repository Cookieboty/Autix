import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class VideoCallbackUrlBuilder {
  constructor(private readonly config: ConfigService) {}

  build(): string | undefined {
    const base = this.config.get<string>('APP_PUBLIC_URL');
    if (!base) return undefined;

    const trimmed = base.replace(/\/+$/, '');
    const secret = this.config.get<string>('VIDEO_CALLBACK_SECRET');
    const suffix = secret ? `?token=${encodeURIComponent(secret)}` : '';
    return `${trimmed}/api/video/callback${suffix}`;
  }
}
