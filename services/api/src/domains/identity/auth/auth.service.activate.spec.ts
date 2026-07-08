import { AuthService } from './auth.service';

function buildAuthService() {
  const settlePendingInvitationReward = jest.fn(async () => ({}));
  const jwtService: any = {
    verify: jest.fn(() => ({
      sub: 'user-1',
      purpose: 'email-activation',
      systemId: 'sys-1',
      inviteCode: 'CODE',
    })),
  };
  const mailService: any = {};
  const inviteService: any = { settlePendingInvitationReward };
  const campaignRewardService: any = { grantRegistrationBonus: jest.fn(async () => null) };
  const identityRepository: any = {
    findUserById: jest.fn(async () => ({ id: 'user-1', status: 'PENDING' })),
    findSystemById: jest.fn(async () => ({ id: 'sys-1', autoApprove: true })),
    findRegistrationByUserAndSystem: jest.fn(async () => ({ id: 'reg-1', status: 'PENDING_ACTIVATION' })),
    findRoleBySystemAndCode: jest.fn(async () => ({ id: 'role-1' })),
    activateRegistration: jest.fn(async () => ({})),
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
