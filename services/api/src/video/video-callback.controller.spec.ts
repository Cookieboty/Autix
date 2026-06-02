import { UnauthorizedException } from '@nestjs/common';
import { VideoCallbackController } from './video-callback.controller';

function make(secret?: string) {
  const flow = { handleCallback: jest.fn().mockResolvedValue(undefined) };
  const config = { get: jest.fn().mockReturnValue(secret) };
  const ctrl = new VideoCallbackController(flow as never, config as never);
  return { ctrl, flow };
}

describe('VideoCallbackController auth', () => {
  it('rejects a callback with an invalid token', async () => {
    const { ctrl, flow } = make('secret-123');

    await expect(
      ctrl.handleCallback('wrong', { id: 't1' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(flow.handleCallback).not.toHaveBeenCalled();
  });

  it('processes a callback with the valid token', async () => {
    const { ctrl, flow } = make('secret-123');

    const res = await ctrl.handleCallback('secret-123', {
      id: 't1',
      status: 'succeeded',
    });

    expect(flow.handleCallback).toHaveBeenCalledWith(
      't1',
      expect.objectContaining({ id: 't1' }),
    );
    expect(res).toEqual({ received: true });
  });

  it('degrades to open processing when no secret is configured', async () => {
    const { ctrl, flow } = make(undefined);

    await ctrl.handleCallback(undefined, { id: 't2' });

    expect(flow.handleCallback).toHaveBeenCalledWith(
      't2',
      expect.objectContaining({ id: 't2' }),
    );
  });
});
