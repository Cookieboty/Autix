import {
  getSeedanceDuration,
  getSeedanceErrorMessage,
  getSeedanceLastFrameUrl,
  getSeedanceStatus,
  getSeedanceVideoUrl,
} from './seedance-task-payload';

describe('seedance task payload helpers', () => {
  it('reads status and top-level media fields', () => {
    const payload = {
      status: 'succeeded',
      video_url: 'https://provider.test/video.mp4',
      last_frame_url: 'https://provider.test/last.png',
      duration: 5,
    };

    expect(getSeedanceStatus(payload)).toBe('succeeded');
    expect(getSeedanceVideoUrl(payload)).toBe('https://provider.test/video.mp4');
    expect(getSeedanceLastFrameUrl(payload)).toBe('https://provider.test/last.png');
    expect(getSeedanceDuration(payload)).toBe(5);
  });

  it('falls back to nested content media fields', () => {
    const payload = {
      status: 'succeeded',
      content: {
        video_url: 'https://provider.test/content-video.mp4',
        last_frame_url: 'https://provider.test/content-last.png',
      },
    };

    expect(getSeedanceVideoUrl(payload)).toBe('https://provider.test/content-video.mp4');
    expect(getSeedanceLastFrameUrl(payload)).toBe('https://provider.test/content-last.png');
  });

  it('uses provider error message when present', () => {
    expect(
      getSeedanceErrorMessage(
        { status: 'failed', error: { message: 'provider rejected' } },
        'failed',
      ),
    ).toBe('provider rejected');
  });

  it('falls back to status for missing or invalid error message', () => {
    expect(getSeedanceErrorMessage({ status: 'failed' }, 'failed')).toBe('failed');
    expect(getSeedanceErrorMessage({ status: 'failed', error: {} }, 'failed')).toBe(
      'failed',
    );
  });
});
