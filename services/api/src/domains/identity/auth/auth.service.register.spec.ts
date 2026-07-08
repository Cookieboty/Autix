import { AuthService } from './auth.service';

function buildAuthService(autoApprove: boolean) {
  const createRegistration = jest.fn(async () => ({ id: 'user-1', email: 'a@b.c', username: 'u' }));
  const jwtService: any = { sign: jest.fn(() => 'tok') };
  const mailService: any = { sendActivationEmail: jest.fn(() => ({ catch: () => {} })) };
  const inviteService: any = { recordInvitation: jest.fn(async () => null) };
  const campaignRewardService: any = { grantRegistrationBonus: jest.fn(async () => null) };
  const identityRepository: any = {
    findUserByUsername: jest.fn(async () => null),
    findUserByEmail: jest.fn(async () => null),
    findSystemByCode: jest.fn(async () => ({ id: 'sys-1', autoApprove })),
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
