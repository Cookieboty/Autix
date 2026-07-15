import { AdminService } from './admin.service';
import { AdminAuditStore } from './admin-audit.store';
import type { AuthUser } from '@autix/domain';

function buildService() {
  const adminRepository = {
    createPointsPackage: vi.fn().mockResolvedValue({ id: 'pkg-1' }),
    updatePointsPackage: vi.fn().mockResolvedValue({ id: 'pkg-1' }),
    deletePointsPackage: vi.fn().mockResolvedValue({ id: 'pkg-1' }),
  } as any;

  const auditStore = new AdminAuditStore();

  const service = new AdminService(
    adminRepository,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    auditStore,
    {} as any,
  );

  return { adminRepository, auditStore, service };
}

const adminUser: AuthUser = {
  id: 'admin-1',
  username: 'admin',
  email: 'admin@example.com',
  isSuperAdmin: true,
  status: 'ACTIVE',
  permissions: [],
  roles: [],
};

describe('AdminService membership package writes', () => {
  it('creates points packages with current UI fields', async () => {
    const { adminRepository, service } = buildService();

    await service.createPointsPackage(adminUser, {
      code: 'starter',
      name: 'Starter Pack',
      description: 'For trials',
      price: '9.90',
      points: 1000,
      validityDays: 180,
      usageScope: { allowedTaskTypes: [] },
      showCommercialLicense: true,
      isActive: true,
      sort: 10,
    });

    expect(adminRepository.createPointsPackage).toHaveBeenCalledWith({
      code: 'starter',
      name: 'Starter Pack',
      description: 'For trials',
      price: '9.90',
      points: 1000,
      validityDays: 180,
      usageScope: { allowedTaskTypes: [] },
      showCommercialLicense: true,
      isActive: true,
      sort: 10,
    });
  });

  it('supports partial points package updates', async () => {
    const { adminRepository, service } = buildService();

    await service.updatePointsPackage(adminUser, 'pkg-1', {
      code: '',
      description: null,
      showCommercialLicense: false,
      isActive: false,
    });

    expect(adminRepository.updatePointsPackage).toHaveBeenCalledWith(
      'pkg-1',
      {
        code: null,
        description: null,
        showCommercialLicense: false,
        isActive: false,
      },
    );
  });

  it('deletes points packages and records an audit entry', async () => {
    const { adminRepository, auditStore, service } = buildService();

    await service.deletePointsPackage(adminUser, 'pkg-1');

    expect(adminRepository.deletePointsPackage).toHaveBeenCalledWith('pkg-1');

    const { items } = auditStore.query({ action: 'points_packages.delete' });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      action: 'points_packages.delete',
      actorId: adminUser.id,
      payload: { id: 'pkg-1' },
    });
  });
});
