import { AuthService } from './auth.service';

function buildAuthService(autoApprove: boolean) {
  const createRegistration = vi.fn(async () => ({ id: 'user-1', email: 'a@b.c', username: 'u' }));
  const jwtService: any = { sign: vi.fn(() => 'tok') };
  const mailService: any = { sendActivationEmail: vi.fn(() => ({ catch: () => {} })) };
  const inviteService: any = { recordInvitation: vi.fn(async () => null) };
  const campaignRewardService: any = { grantRegistrationBonus: vi.fn(async () => null) };
  const identityRepository: any = {
    findUserByUsername: vi.fn(async () => null),
    findUserByEmail: vi.fn(async () => null),
    findSystemByCode: vi.fn(async () => ({ id: 'sys-1', autoApprove })),
    createRegistration,
  };
  const service = new AuthService(
    jwtService,
    mailService,
    inviteService,
    campaignRewardService,
    identityRepository,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return { service, createRegistration };
}

const dto = {
  username: 'u',
  email: 'a@b.c',
  password: 'pw',
  systemCode: 'sys',
  inviteCode: 'CODE',
} as any;

describe('AuthService.register signup fingerprint capture (R1-2)', () => {
  it('persists signupIp/signupDeviceId on the auto-approve path', async () => {
    const { service, createRegistration } = buildAuthService(true);

    await service.register(dto, { signupIp: '1.2.3.4', signupDeviceId: 'dev-9' });

    expect(createRegistration).toHaveBeenCalledWith(
      expect.objectContaining({ signupIp: '1.2.3.4', signupDeviceId: 'dev-9' }),
    );
  });

  it('persists signupIp/signupDeviceId on the manual-approval path', async () => {
    const { service, createRegistration } = buildAuthService(false);

    await service.register(dto, { signupIp: '5.6.7.8', signupDeviceId: 'dev-1' });

    expect(createRegistration).toHaveBeenCalledWith(
      expect.objectContaining({ signupIp: '5.6.7.8', signupDeviceId: 'dev-1' }),
    );
  });
});
