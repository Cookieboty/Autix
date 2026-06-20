import { AdminService } from './admin.service';
import { AdminAuditStore } from './admin-audit.store';
import type { AuthUser } from '@autix/types';

function buildService() {
  const prisma = {
    points_packages: {
      create: jest.fn().mockResolvedValue({ id: 'pkg-1' }),
      update: jest.fn().mockResolvedValue({ id: 'pkg-1' }),
    },
  } as any;

  const service = new AdminService(
    prisma,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    new AdminAuditStore(),
    {} as any,
  );

  return { prisma, service };
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
    const { prisma, service } = buildService();

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

    expect(prisma.points_packages.create).toHaveBeenCalledWith({
      data: {
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
      },
    });
  });

  it('supports partial points package updates', async () => {
    const { prisma, service } = buildService();

    await service.updatePointsPackage(adminUser, 'pkg-1', {
      code: '',
      description: null,
      showCommercialLicense: false,
      isActive: false,
    });

    expect(prisma.points_packages.update).toHaveBeenCalledWith({
      where: { id: 'pkg-1' },
      data: {
        code: null,
        description: null,
        showCommercialLicense: false,
        isActive: false,
      },
    });
  });
});
