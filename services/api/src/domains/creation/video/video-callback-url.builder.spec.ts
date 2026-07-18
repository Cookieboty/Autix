import { VideoCallbackUrlBuilder } from './video-callback-url.builder';

describe('VideoCallbackUrlBuilder', () => {
  it('returns undefined when APP_PUBLIC_URL is not configured', () => {
    const config = { get: vi.fn(() => undefined) };
    const builder = new VideoCallbackUrlBuilder(config as never);

    expect(builder.build('ark-video@v3')).toBeUndefined();
  });

  it('builds the callback URL with a URL-encoded token', () => {
    const config = {
      get: vi.fn((key: string) => {
        if (key === 'APP_PUBLIC_URL') return 'https://app.test/';
        if (key === 'VIDEO_CALLBACK_SECRET') return 'a token+with/slash';
        return undefined;
      }),
    };
    const builder = new VideoCallbackUrlBuilder(config as never);

    expect(builder.build('ark-video@v3')).toBe(
      'https://app.test/api/video/callback/ark-video%40v3?token=a%20token%2Bwith%2Fslash',
    );
  });

  // preset key 含 '@' —— 必须编码，否则回调地址在部分上游/网关里可能被截断或误解析。
  it('embeds the protocolKey in the callback path, URL-encoded', () => {
    const config = {
      get: vi.fn((key: string) => {
        if (key === 'APP_PUBLIC_URL') return 'https://app.example.com';
        if (key === 'VIDEO_CALLBACK_SECRET') return 's3cret';
        return undefined;
      }),
    };
    const builder = new VideoCallbackUrlBuilder(config as never);

    expect(builder.build('ark-video@v3')).toBe(
      'https://app.example.com/api/video/callback/ark-video%40v3?token=s3cret',
    );
  });
});
