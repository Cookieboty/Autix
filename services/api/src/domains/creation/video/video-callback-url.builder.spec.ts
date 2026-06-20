import { VideoCallbackUrlBuilder } from './video-callback-url.builder';

describe('VideoCallbackUrlBuilder', () => {
  it('returns undefined when APP_PUBLIC_URL is not configured', () => {
    const config = { get: jest.fn(() => undefined) };
    const builder = new VideoCallbackUrlBuilder(config as never);

    expect(builder.build()).toBeUndefined();
  });

  it('builds the callback URL with a URL-encoded token', () => {
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'APP_PUBLIC_URL') return 'https://app.test/';
        if (key === 'VIDEO_CALLBACK_SECRET') return 'a token+with/slash';
        return undefined;
      }),
    };
    const builder = new VideoCallbackUrlBuilder(config as never);

    expect(builder.build()).toBe(
      'https://app.test/api/video/callback?token=a%20token%2Bwith%2Fslash',
    );
  });
});
