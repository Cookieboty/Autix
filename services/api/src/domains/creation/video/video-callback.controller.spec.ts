import { UnauthorizedException } from '@nestjs/common';
import { handleVideoCallbackRequest } from './video-callback.handler';

function make(secret?: string) {
  const flow = { handleCallback: jest.fn().mockResolvedValue(undefined) };
  const config = { get: jest.fn().mockReturnValue(secret) };
  const logger = {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  return { config, flow, logger };
}

describe('VideoCallbackController auth', () => {
  it('rejects a callback with an invalid token', async () => {
    const { config, flow, logger } = make('secret-123');

    await expect(
      handleVideoCallbackRequest({
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
      't1',
      expect.objectContaining({ id: 't1' }),
    );
    expect(res).toEqual({ received: true });
  });

  it('fails closed (rejects) when no secret is configured', async () => {
    const { config, flow, logger } = make(undefined);

    await expect(
      handleVideoCallbackRequest({
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
