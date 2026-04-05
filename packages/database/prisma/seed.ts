import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('Admin@123456', 10);

  const superAdminRole = await prisma.role.upsert({
    where: { code: 'SUPER_ADMIN' },
    update: {},
    create: {
      name: '超级管理员',
      code: 'SUPER_ADMIN',
      description: '系统超级管理员，拥有所有权限',
      sort: 0,
    },
  });

  const adminUser = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@example.com',
      password: hashedPassword,
      realName: '系统管理员',
      status: 'ACTIVE',
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: adminUser.id,
        roleId: superAdminRole.id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      roleId: superAdminRole.id,
    },
  });

  const modules = ['user', 'role', 'permission', 'department', 'menu'];
  const actions = ['CREATE', 'READ', 'UPDATE', 'DELETE'];

  for (const module of modules) {
    for (const action of actions) {
      const permission = await prisma.permission.upsert({
        where: { code: `${module}:${action.toLowerCase()}` },
        update: {},
        create: {
          name: `${module} ${action}`,
          code: `${module}:${action.toLowerCase()}`,
          module,
          action: action as any,
          description: `${action} ${module}`,
        },
      });

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: superAdminRole.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: superAdminRole.id,
          permissionId: permission.id,
        },
      });
    }
  }

  console.log('Seed completed!');
  console.log('Admin user: admin / Admin@123456');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
