import { RegistrationService } from './registration.service';

function buildRegistrationService() {
  const settlePendingInvitationReward = jest.fn(async () => ({}));
  const registrationRepository: any = {
    findById: jest.fn(async () => ({
      id: 'reg-1',
      status: 'PENDING',
      systemId: 'sys-1',
      userId: 'user-1',
    })),
    findRoleBySystemAndCode: jest.fn(async () => ({ id: 'role-1' })),
    approveRegistration: jest.fn(async () => ({})),
    findApprovalEmailUser: jest.fn(async () => ({ email: 'a@b.c', username: 'u' })),
  };
  const mailService: any = { sendApprovalEmail: jest.fn(() => ({ catch: () => {} })) };
  const inviteService: any = { settlePendingInvitationReward };
  const service = new RegistrationService(
    registrationRepository,
    mailService,
    inviteService,
  );
  return { service, settlePendingInvitationReward };
}

const superAdmin = { id: 'admin-1', isSuperAdmin: true } as any;

describe('RegistrationService.approve invite settlement', () => {
  it('settles the pending invitation reward after admin approval', async () => {
    const { service, settlePendingInvitationReward } = buildRegistrationService();

    await service.approve('reg-1', superAdmin, {} as any);

    expect(settlePendingInvitationReward).toHaveBeenCalledWith('user-1');
  });
});
