import { UnauthorizedException } from '@nestjs/common';
import { VideoCallbackController } from './video-callback.controller';
import { handleVideoCallbackRequest } from './video-callback.handler';

function make(secret?: string) {
  const flow = { handleCallback: vi.fn().mockResolvedValue(undefined) };
  const config = { get: vi.fn().mockReturnValue(secret) };
  const logger = {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
  return { config, flow, logger };
}

describe('handleVideoCallbackRequest auth', () => {
  it('rejects a callback with an invalid token', async () => {
    const { config, flow, logger } = make('secret-123');

    await expect(
      handleVideoCallbackRequest({
        protocolKey: 'ark-video@v3',
        token: 'wrong',
        body: { id: 't1' },
        config,
        generationFlow: flow,
        logger,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(flow.handleCallback).not.toHaveBeenCalled();
  });

  it('processes a callback with the valid token', async () => {
    const { config, flow, logger } = make('secret-123');

    const res = await handleVideoCallbackRequest({
      protocolKey: 'ark-video@v3',
      token: 'secret-123',
      body: {
        id: 't1',
        status: 'succeeded',
      },
      config,
      generationFlow: flow,
      logger,
    });

    expect(flow.handleCallback).toHaveBeenCalledWith(
      'ark-video@v3',
      't1',
      expect.objectContaining({ id: 't1' }),
    );
    expect(res).toEqual({ received: true });
  });

  // fail-closed：密钥未配置必须 401，绝不放行。继承自现网行为，不可降级
  // （video-callback.handler.ts 的历史实现即如此，verifyVideoCallback 保留了这条契约）。
  it('fails closed (rejects) when no secret is configured', async () => {
    const { config, flow, logger } = make(undefined);

    await expect(
      handleVideoCallbackRequest({
        protocolKey: 'ark-video@v3',
        token: undefined,
        body: { id: 't2' },
        config,
        generationFlow: flow,
        logger,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(flow.handleCallback).not.toHaveBeenCalled();
  });
});

describe('VideoCallbackController', () => {
  it('routes the callback by protocolKey from the path', async () => {
    const { config, flow } = make('s3cret');
    const controller = new VideoCallbackController(flow as never, config as never);

    await controller.handleCallback('ark-video@v3', 's3cret', {
      id: 'task_1',
      status: 'succeeded',
    });

    expect(flow.handleCallback).toHaveBeenCalledWith(
      'ark-video@v3',
      'task_1',
      expect.anything(),
    );
  });

  // fail-closed：密钥未配置必须 401，绝不放行。
  it('rejects when VIDEO_CALLBACK_SECRET is not configured', async () => {
    const { config, flow } = make(undefined);
    const controller = new VideoCallbackController(flow as never, config as never);

    await expect(
      controller.handleCallback('ark-video@v3', 'anything', {}),
    ).rejects.toThrow(UnauthorizedException);
    expect(flow.handleCallback).not.toHaveBeenCalled();
  });

  // 迁移期：已提交任务的 callback_url 写死在上游、改不了。旧路由删了会让窗口内回调全 404。
  it('keeps the deprecated legacy route bound to arkVideoV3', async () => {
    const { config, flow } = make('s3cret');
    const controller = new VideoCallbackController(flow as never, config as never);

    await controller.handleLegacyCallback('s3cret', {
      id: 'task_1',
      status: 'succeeded',
    });

    expect(flow.handleCallback).toHaveBeenCalledWith(
      'ark-video@v3',
      'task_1',
      expect.anything(),
    );
  });
});
