import { getDatabaseUrl, PrismaClient } from '@autix/database';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * 生产环境 seed：每次 API 启动时执行，必须幂等。
 *
 * 灌的内容（保持最小集，只满足超级管理员可用 + chat 服务依赖）：
 *   - System: admin-system, chat
 *   - Menu:  admin-system 下的 3 个（用户管理 / 角色管理 / 权限配置中心）
 *   - Permission: admin-system 菜单关联的 BACKEND/FRONTEND 权限点
 *   - Role:  chat 系统的 SYSTEM_ADMIN / USER（注册审批流程依赖）
 *
 * 不灌：cms-system、admin-system 的角色、role-permission / role-menu 关联。
 * 超管登录看菜单不依赖角色（menu.service.ts: isSuperAdmin 直接读全部 visible 菜单）。
 */
const adapter = new PrismaPg({
  connectionString: getDatabaseUrl(),
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 [prod-seed] start');

  // ── 1. Systems ───────────────────────────────────────────────────────────
  const adminSystem = await prisma.system.upsert({
    where: { code: 'admin-system' },
    update: {},
    create: {
      name: '后台管理系统',
      code: 'admin-system',
      description: '用户、角色、权限管理',
      status: 'ACTIVE',
      sort: 1,
    },
  });

  const chatSystem = await prisma.system.upsert({
    where: { code: 'chat' },
    update: {},
    create: {
      name: 'Chat',
      code: 'chat',
      description: 'AI 智能对话系统',
      status: 'ACTIVE',
      sort: 3,
    },
  });

  // ── 2. admin-system 下的菜单 ─────────────────────────────────────────────
  const userMenu = await prisma.menu.upsert({
    where: { systemId_code: { systemId: adminSystem.id, code: 'user-management' } },
    update: {
      nameEn: 'User Management',
      nameZhTW: '使用者管理',
      nameFr: 'Gestion des utilisateurs',
      nameJa: 'ユーザー管理',
      nameRu: 'Управление пользователями',
      nameVi: 'Quản lý người dùng',
    },
    create: {
      systemId: adminSystem.id,
      name: '用户管理',
      nameEn: 'User Management',
      nameZhTW: '使用者管理',
      nameFr: 'Gestion des utilisateurs',
      nameJa: 'ユーザー管理',
      nameRu: 'Управление пользователями',
      nameVi: 'Quản lý người dùng',
      code: 'user-management',
      path: '/users',
      icon: 'Users',
      sort: 1,
      visible: true,
    },
  });

  const roleMenu = await prisma.menu.upsert({
    where: { systemId_code: { systemId: adminSystem.id, code: 'role-management' } },
    update: {
      sort: 3,
      nameEn: 'Role Management',
      nameZhTW: '角色管理',
      nameFr: 'Gestion des rôles',
      nameJa: 'ロール管理',
      nameRu: 'Управление ролями',
      nameVi: 'Quản lý vai trò',
    },
    create: {
      systemId: adminSystem.id,
      name: '角色管理',
      nameEn: 'Role Management',
      nameZhTW: '角色管理',
      nameFr: 'Gestion des rôles',
      nameJa: 'ロール管理',
      nameRu: 'Управление ролями',
      nameVi: 'Quản lý vai trò',
      code: 'role-management',
      path: '/roles',
      icon: 'Shield',
      sort: 3,
      visible: true,
    },
  });

  const permissionCenterMenu = await prisma.menu.upsert({
    where: { systemId_code: { systemId: adminSystem.id, code: 'permission-center' } },
    update: {
      sort: 4,
      nameEn: 'Permission Center',
      nameZhTW: '權限配置中心',
      nameFr: 'Centre de permissions',
      nameJa: '権限設定センター',
      nameRu: 'Центр управления правами',
      nameVi: 'Trung tâm phân quyền',
    },
    create: {
      systemId: adminSystem.id,
      name: '权限配置中心',
      nameEn: 'Permission Center',
      nameZhTW: '權限配置中心',
      nameFr: 'Centre de permissions',
      nameJa: '権限設定センター',
      nameRu: 'Центр управления правами',
      nameVi: 'Trung tâm phân quyền',
      code: 'permission-center',
      path: '/permission-center',
      icon: 'Network',
      sort: 4,
      visible: true,
    },
  });

  // ── 3. 权限点 ────────────────────────────────────────────────────────────
  const permissions: Array<{
    menuId: string;
    name: string;
    code: string;
    type: 'BACKEND' | 'FRONTEND';
    action: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'EXPORT';
  }> = [
    // user-management
    { menuId: userMenu.id, name: '创建用户', code: 'user:create', type: 'BACKEND', action: 'CREATE' },
    { menuId: userMenu.id, name: '查看用户', code: 'user:read', type: 'BACKEND', action: 'READ' },
    { menuId: userMenu.id, name: '更新用户', code: 'user:update', type: 'BACKEND', action: 'UPDATE' },
    { menuId: userMenu.id, name: '删除用户', code: 'user:delete', type: 'BACKEND', action: 'DELETE' },
    { menuId: userMenu.id, name: '导出用户', code: 'user:export', type: 'BACKEND', action: 'EXPORT' },
    { menuId: userMenu.id, name: '新增按钮', code: 'user:btn:create', type: 'FRONTEND', action: 'CREATE' },
    { menuId: userMenu.id, name: '编辑按钮', code: 'user:btn:edit', type: 'FRONTEND', action: 'UPDATE' },
    { menuId: userMenu.id, name: '删除按钮', code: 'user:btn:delete', type: 'FRONTEND', action: 'DELETE' },
    // role-management
    { menuId: roleMenu.id, name: '创建角色', code: 'role:create', type: 'BACKEND', action: 'CREATE' },
    { menuId: roleMenu.id, name: '查看角色', code: 'role:read', type: 'BACKEND', action: 'READ' },
    { menuId: roleMenu.id, name: '更新角色', code: 'role:update', type: 'BACKEND', action: 'UPDATE' },
    { menuId: roleMenu.id, name: '删除角色', code: 'role:delete', type: 'BACKEND', action: 'DELETE' },
    { menuId: roleMenu.id, name: '新增按钮', code: 'role:btn:create', type: 'FRONTEND', action: 'CREATE' },
    { menuId: roleMenu.id, name: '编辑按钮', code: 'role:btn:edit', type: 'FRONTEND', action: 'UPDATE' },
    // permission-center
    { menuId: permissionCenterMenu.id, name: '查看系统', code: 'system:read', type: 'BACKEND', action: 'READ' },
    { menuId: permissionCenterMenu.id, name: '创建系统', code: 'system:create', type: 'BACKEND', action: 'CREATE' },
    { menuId: permissionCenterMenu.id, name: '更新系统', code: 'system:update', type: 'BACKEND', action: 'UPDATE' },
    { menuId: permissionCenterMenu.id, name: '删除系统', code: 'system:delete', type: 'BACKEND', action: 'DELETE' },
    { menuId: permissionCenterMenu.id, name: '创建菜单', code: 'menu:create', type: 'BACKEND', action: 'CREATE' },
    { menuId: permissionCenterMenu.id, name: '查看菜单', code: 'menu:read', type: 'BACKEND', action: 'READ' },
    { menuId: permissionCenterMenu.id, name: '更新菜单', code: 'menu:update', type: 'BACKEND', action: 'UPDATE' },
    { menuId: permissionCenterMenu.id, name: '删除菜单', code: 'menu:delete', type: 'BACKEND', action: 'DELETE' },
    { menuId: permissionCenterMenu.id, name: '创建权限', code: 'permission:create', type: 'BACKEND', action: 'CREATE' },
    { menuId: permissionCenterMenu.id, name: '查看权限', code: 'permission:read', type: 'BACKEND', action: 'READ' },
    { menuId: permissionCenterMenu.id, name: '更新权限', code: 'permission:update', type: 'BACKEND', action: 'UPDATE' },
    { menuId: permissionCenterMenu.id, name: '删除权限', code: 'permission:delete', type: 'BACKEND', action: 'DELETE' },
  ];

  for (const p of permissions) {
    await prisma.permission.upsert({
      where: { code: p.code },
      update: {},
      create: p,
    });
  }

  // ── 4. chat 系统的菜单（原 chat-web /system 硬编码导航） ────────────────
  const chatMenuDefs = [
    {
      code: 'template-review',
      name: '模板审核', nameEn: 'Template Review',
      nameZhTW: '模板審核', nameFr: 'Examen des modèles',
      nameJa: 'テンプレート審査', nameRu: 'Проверка шаблонов',
      nameVi: 'Duyệt mẫu',
      path: '/templates', icon: 'FileText', sort: 1,
    },
    {
      code: 'membership-users',
      name: '用户管理', nameEn: 'Membership Users',
      nameZhTW: '使用者管理', nameFr: 'Gestion des membres',
      nameJa: '会員管理', nameRu: 'Управление пользователями',
      nameVi: 'Quản lý thành viên',
      path: '/membership/users', icon: 'Users', sort: 2,
    },
    {
      code: 'membership-levels',
      name: '会员等级', nameEn: 'Membership Levels',
      nameZhTW: '會員等級', nameFr: 'Niveaux de membres',
      nameJa: '会員ランク', nameRu: 'Уровни членства',
      nameVi: 'Cấp thành viên',
      path: '/membership/levels', icon: 'Crown', sort: 3,
    },
    {
      code: 'membership-packages',
      name: '积分加油包', nameEn: 'Credit Packages',
      nameZhTW: '積分加油包', nameFr: 'Packs de crédits',
      nameJa: 'クレジットパック', nameRu: 'Пакеты кредитов',
      nameVi: 'Gói tín dụng',
      path: '/membership/packages', icon: 'Zap', sort: 4,
    },
    {
      code: 'membership-task-costs',
      name: '任务消耗', nameEn: 'Task Costs',
      nameZhTW: '任務消耗', nameFr: 'Coûts des tâches',
      nameJa: 'タスクコスト', nameRu: 'Стоимость задач',
      nameVi: 'Chi phí nhiệm vụ',
      path: '/membership/task-costs', icon: 'Settings', sort: 5,
    },
    {
      code: 'membership-orders',
      name: '订单管理', nameEn: 'Orders',
      nameZhTW: '訂單管理', nameFr: 'Gestion des commandes',
      nameJa: '注文管理', nameRu: 'Управление заказами',
      nameVi: 'Quản lý đơn hàng',
      path: '/membership/orders', icon: 'Receipt', sort: 6,
    },
    {
      code: 'membership-points',
      name: '积分流水', nameEn: 'Points History',
      nameZhTW: '積分流水', nameFr: 'Historique des points',
      nameJa: 'ポイント履歴', nameRu: 'История баллов',
      nameVi: 'Lịch sử điểm',
      path: '/membership/points', icon: 'History', sort: 7,
    },
  ] as const;

  const chatMenus: { id: string }[] = [];
  for (const def of chatMenuDefs) {
    const m = await prisma.menu.upsert({
      where: { systemId_code: { systemId: chatSystem.id, code: def.code } },
      update: {
        nameEn: def.nameEn, nameZhTW: def.nameZhTW, nameFr: def.nameFr,
        nameJa: def.nameJa, nameRu: def.nameRu, nameVi: def.nameVi,
        sort: def.sort,
      },
      create: {
        systemId: chatSystem.id,
        name: def.name, nameEn: def.nameEn, nameZhTW: def.nameZhTW,
        nameFr: def.nameFr, nameJa: def.nameJa, nameRu: def.nameRu,
        nameVi: def.nameVi,
        code: def.code, path: def.path, icon: def.icon,
        sort: def.sort, visible: true,
      },
    });
    chatMenus.push(m);
  }

  // ── 5. chat 系统的角色（chat 注册审批依赖） ─────────────────────────────
  const chatAdminRole = await prisma.role.upsert({
    where: { systemId_code: { systemId: chatSystem.id, code: 'SYSTEM_ADMIN' } },
    update: {},
    create: {
      systemId: chatSystem.id,
      name: '系统管理员',
      code: 'SYSTEM_ADMIN',
      description: 'Chat 系统管理员，可审批注册申请',
      sort: 1,
    },
  });

  await prisma.role.upsert({
    where: { systemId_code: { systemId: chatSystem.id, code: 'USER' } },
    update: {},
    create: {
      systemId: chatSystem.id,
      name: '普通用户',
      code: 'USER',
      description: 'Chat 系统普通用户，注册审批通过后自动分配',
      sort: 2,
    },
  });

  // ── 6. chat SYSTEM_ADMIN 角色 ↔ 菜单关联 ──────────────────────────────
  for (const menu of chatMenus) {
    await prisma.roleMenu.upsert({
      where: { roleId_menuId: { roleId: chatAdminRole.id, menuId: menu.id } },
      update: {},
      create: { roleId: chatAdminRole.id, menuId: menu.id },
    });
  }

  console.log('✅ [prod-seed] done');
}

main()
  .catch((e) => {
    console.error('❌ [prod-seed] failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
