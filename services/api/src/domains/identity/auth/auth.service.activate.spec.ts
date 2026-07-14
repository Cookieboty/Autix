import { AuthService } from './auth.service';

function buildAuthService() {
  const settlePendingInvitationReward = vi.fn(async () => ({}));
  const jwtService: any = {
    verify: vi.fn(() => ({
      sub: 'user-1',
      purpose: 'email-activation',
      systemId: 'sys-1',
      inviteCode: 'CODE',
    })),
  };
  const mailService: any = {};
  const inviteService: any = { settlePendingInvitationReward };
  const campaignRewardService: any = { grantRegistrationBonus: vi.fn(async () => null) };
  const identityRepository: any = {
    findUserById: vi.fn(async () => ({ id: 'user-1', status: 'PENDING' })),
    findSystemById: vi.fn(async () => ({ id: 'sys-1', autoApprove: true })),
    findRegistrationByUserAndSystem: vi.fn(async () => ({ id: 'reg-1', status: 'PENDING_ACTIVATION' })),
    findRoleBySystemAndCode: vi.fn(async () => ({ id: 'role-1' })),
    activateRegistration: vi.fn(async () => ({})),
  };
  const sessionRepository: any = {};
  const tokenFactory: any = {};
  const service = new AuthService(
    jwtService,
    mailService,
    inviteService,
    campaignRewardService,
    identityRepository,
    sessionRepository,
    tokenFactory,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );
  return { service, settlePendingInvitationReward, campaignRewardService };
}

describe('AuthService.activateAccount invite settlement', () => {
  it('settles the pending invitation reward after a successful email activation', async () => {
    const { service, settlePendingInvitationReward, campaignRewardService } = buildAuthService();

    await service.activateAccount({ token: 'tok' } as any);

    expect(settlePendingInvitationReward).toHaveBeenCalledWith('user-1');
    expect(campaignRewardService.grantRegistrationBonus).toHaveBeenCalledWith(
      'user-1',
      'email_activation',
    );
  });
});
