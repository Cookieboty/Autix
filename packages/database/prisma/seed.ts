import { getDatabaseUrl, PrismaClient } from '@autix/database';
import type { PermissionAction, PermissionType } from '@autix/database';
import { PrismaPg } from '@prisma/adapter-pg';
import { seedFeaturedSlots } from './seeds/featured-slots';

const adapter = new PrismaPg({
  connectionString: getDatabaseUrl(),
});
const prisma = new PrismaClient({ adapter });

type SeedPermission = {
  menu: { id: string };
  name: string;
  code: string;
  type: PermissionType;
  action: PermissionAction;
};

async function main() {
  console.log('🌱 Starting seed...');

  // ==================== 1. 创建系统 ====================
  console.log('📦 Creating systems...');
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

  const cmsSystem = await prisma.system.upsert({
    where: { code: 'cms-system' },
    update: {},
    create: {
      name: '内容管理系统',
      code: 'cms-system',
      description: '文章、内容管理',
      status: 'ACTIVE',
      sort: 2,
    },
  });

  // Chat 系统
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

  // ==================== 2. 创建菜单树 ====================
  console.log('🗂️  Creating menus...');

  // 后台管理系统的菜单
  // 后台管理系统菜单
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

  // 内容管理系统的菜单
  const articleMenu = await prisma.menu.upsert({
    where: { systemId_code: { systemId: cmsSystem.id, code: 'article-management' } },
    update: {
      nameEn: 'Article Management',
      nameZhTW: '文章管理',
      nameFr: 'Gestion des articles',
      nameJa: '記事管理',
      nameRu: 'Управление статьями',
      nameVi: 'Quản lý bài viết',
    },
    create: {
      systemId: cmsSystem.id,
      name: '文章管理',
      nameEn: 'Article Management',
      nameZhTW: '文章管理',
      nameFr: 'Gestion des articles',
      nameJa: '記事管理',
      nameRu: 'Управление статьями',
      nameVi: 'Quản lý bài viết',
      code: 'article-management',
      path: '/articles',
      icon: 'FileText',
      sort: 1,
      visible: true,
    },
  });

  const categoryMenu = await prisma.menu.upsert({
    where: { systemId_code: { systemId: cmsSystem.id, code: 'category-management' } },
    update: {
      nameEn: 'Category Management',
      nameZhTW: '分類管理',
      nameFr: 'Gestion des catégories',
      nameJa: 'カテゴリ管理',
      nameRu: 'Управление категориями',
      nameVi: 'Quản lý danh mục',
    },
    create: {
      systemId: cmsSystem.id,
      name: '分类管理',
      nameEn: 'Category Management',
      nameZhTW: '分類管理',
      nameFr: 'Gestion des catégories',
      nameJa: 'カテゴリ管理',
      nameRu: 'Управление категориями',
      nameVi: 'Quản lý danh mục',
      code: 'category-management',
      path: '/categories',
      icon: 'Folder',
      sort: 2,
      visible: true,
    },
  });

  // Chat 系统菜单
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
      name: '计费规则', nameEn: 'Pricing Rules',
      nameZhTW: '計費規則', nameFr: 'Règles de tarification',
      nameJa: '課金ルール', nameRu: 'Правила тарификации',
      nameVi: 'Quy tắc tính phí',
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
    {
      code: 'system-models',
      name: '系统模型配置', nameEn: 'System Models',
      nameZhTW: '系統模型配置', nameFr: 'Modèles système',
      nameJa: 'システムモデル設定', nameRu: 'Системные модели',
      nameVi: 'Cấu hình mô hình hệ thống',
      path: '/models', icon: 'Globe', sort: 8,
    },
    {
      code: 'system-settings',
      name: '系统配置', nameEn: 'System Settings',
      nameZhTW: '系統配置', nameFr: 'Paramètres système',
      nameJa: 'システム設定', nameRu: 'Системные настройки',
      nameVi: 'Cấu hình hệ thống',
      path: '/settings', icon: 'Settings', sort: 9,
    },
    {
      code: 'system-prompts',
      name: '系统 Prompt', nameEn: 'System Prompts',
      nameZhTW: '系統 Prompt', nameFr: 'Prompts système',
      nameJa: 'システムプロンプト', nameRu: 'Системные промпты',
      nameVi: 'Prompt hệ thống',
      path: '/prompts', icon: 'FileText', sort: 10,
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

  // ==================== 3. 创建权限点 ====================
  console.log('🔐 Creating permissions...');

  // 用户管理权限
  const userPermissions: SeedPermission[] = [
    // 后端权限
    { menu: userMenu, name: '创建用户', code: 'user:create', type: 'BACKEND', action: 'CREATE' },
    { menu: userMenu, name: '查看用户', code: 'user:read', type: 'BACKEND', action: 'READ' },
    { menu: userMenu, name: '更新用户', code: 'user:update', type: 'BACKEND', action: 'UPDATE' },
    { menu: userMenu, name: '删除用户', code: 'user:delete', type: 'BACKEND', action: 'DELETE' },
    { menu: userMenu, name: '导出用户', code: 'user:export', type: 'BACKEND', action: 'EXPORT' },
    // 前端权限
    { menu: userMenu, name: '新增按钮', code: 'user:btn:create', type: 'FRONTEND', action: 'CREATE' },
    { menu: userMenu, name: '编辑按钮', code: 'user:btn:edit', type: 'FRONTEND', action: 'UPDATE' },
    { menu: userMenu, name: '删除按钮', code: 'user:btn:delete', type: 'FRONTEND', action: 'DELETE' },
  ];

  // 角色管理权限
  const rolePermissions: SeedPermission[] = [
    { menu: roleMenu, name: '创建角色', code: 'role:create', type: 'BACKEND', action: 'CREATE' },
    { menu: roleMenu, name: '查看角色', code: 'role:read', type: 'BACKEND', action: 'READ' },
    { menu: roleMenu, name: '更新角色', code: 'role:update', type: 'BACKEND', action: 'UPDATE' },
    { menu: roleMenu, name: '删除角色', code: 'role:delete', type: 'BACKEND', action: 'DELETE' },
    { menu: roleMenu, name: '新增按钮', code: 'role:btn:create', type: 'FRONTEND', action: 'CREATE' },
    { menu: roleMenu, name: '编辑按钮', code: 'role:btn:edit', type: 'FRONTEND', action: 'UPDATE' },
  ];

  // 权限配置中心权限（整合系统、菜单、权限管理）
  const permissionCenterPermissions: SeedPermission[] = [
    // 系统管理
    { menu: permissionCenterMenu, name: '查看系统', code: 'system:read', type: 'BACKEND', action: 'READ' },
    { menu: permissionCenterMenu, name: '创建系统', code: 'system:create', type: 'BACKEND', action: 'CREATE' },
    { menu: permissionCenterMenu, name: '更新系统', code: 'system:update', type: 'BACKEND', action: 'UPDATE' },
    { menu: permissionCenterMenu, name: '删除系统', code: 'system:delete', type: 'BACKEND', action: 'DELETE' },
    // 菜单管理
    { menu: permissionCenterMenu, name: '创建菜单', code: 'menu:create', type: 'BACKEND', action: 'CREATE' },
    { menu: permissionCenterMenu, name: '查看菜单', code: 'menu:read', type: 'BACKEND', action: 'READ' },
    { menu: permissionCenterMenu, name: '更新菜单', code: 'menu:update', type: 'BACKEND', action: 'UPDATE' },
    { menu: permissionCenterMenu, name: '删除菜单', code: 'menu:delete', type: 'BACKEND', action: 'DELETE' },
    // 权限管理
    { menu: permissionCenterMenu, name: '创建权限', code: 'permission:create', type: 'BACKEND', action: 'CREATE' },
    { menu: permissionCenterMenu, name: '查看权限', code: 'permission:read', type: 'BACKEND', action: 'READ' },
    { menu: permissionCenterMenu, name: '更新权限', code: 'permission:update', type: 'BACKEND', action: 'UPDATE' },
    { menu: permissionCenterMenu, name: '删除权限', code: 'permission:delete', type: 'BACKEND', action: 'DELETE' },
  ];

  // 文章管理权限（CMS系统）
  const articlePermissions: SeedPermission[] = [
    { menu: articleMenu, name: '创建文章', code: 'article:create', type: 'BACKEND', action: 'CREATE' },
    { menu: articleMenu, name: '查看文章', code: 'article:read', type: 'BACKEND', action: 'READ' },
    { menu: articleMenu, name: '更新文章', code: 'article:update', type: 'BACKEND', action: 'UPDATE' },
    { menu: articleMenu, name: '删除文章', code: 'article:delete', type: 'BACKEND', action: 'DELETE' },
    { menu: articleMenu, name: '发布文章', code: 'article:publish', type: 'BACKEND', action: 'UPDATE' },
    { menu: articleMenu, name: '新增按钮', code: 'article:btn:create', type: 'FRONTEND', action: 'CREATE' },
  ];

  // 分类管理权限（CMS系统）
  const categoryPermissions: SeedPermission[] = [
    { menu: categoryMenu, name: '创建分类', code: 'category:create', type: 'BACKEND', action: 'CREATE' },
    { menu: categoryMenu, name: '查看分类', code: 'category:read', type: 'BACKEND', action: 'READ' },
    { menu: categoryMenu, name: '更新分类', code: 'category:update', type: 'BACKEND', action: 'UPDATE' },
    { menu: categoryMenu, name: '删除分类', code: 'category:delete', type: 'BACKEND', action: 'DELETE' },
  ];

  const allPermissions = [
    ...userPermissions,
    ...rolePermissions,
    ...permissionCenterPermissions,
    ...articlePermissions,
    ...categoryPermissions,
  ];

  const createdPermissions: Array<{ id: string; code: string }> = [];
  for (const perm of allPermissions) {
    const permission = await prisma.permission.upsert({
      where: { code: perm.code },
      update: {},
      create: {
        menuId: perm.menu.id,
        name: perm.name,
        code: perm.code,
        type: perm.type,
        action: perm.action,
      },
    });
    createdPermissions.push(permission);
  }

  // ==================== 4. 创建角色 ====================
  console.log('👥 Creating roles...');

  // 后台管理系统的角色
  const adminSystemAdmin = await prisma.role.upsert({
    where: { systemId_code: { systemId: adminSystem.id, code: 'admin' } },
    update: {},
    create: {
      systemId: adminSystem.id,
      name: '系统管理员',
      code: 'admin',
      description: '后台管理系统的管理员，拥有该系统所有权限',
      sort: 1,
    },
  });

  await prisma.role.upsert({
    where: { systemId_code: { systemId: adminSystem.id, code: 'user' } },
    update: {},
    create: {
      systemId: adminSystem.id,
      name: '普通用户',
      code: 'user',
      description: '后台管理系统的普通用户',
      sort: 2,
    },
  });

  // 内容管理系统的角色
  const cmsSystemAdmin = await prisma.role.upsert({
    where: { systemId_code: { systemId: cmsSystem.id, code: 'admin' } },
    update: {},
    create: {
      systemId: cmsSystem.id,
      name: '内容管理员',
      code: 'admin',
      description: '内容管理系统的管理员',
      sort: 1,
    },
  });

  const cmsSystemEditor = await prisma.role.upsert({
    where: { systemId_code: { systemId: cmsSystem.id, code: 'editor' } },
    update: {},
    create: {
      systemId: cmsSystem.id,
      name: '内容编辑',
      code: 'editor',
      description: '负责内容的创建和编辑',
      sort: 2,
    },
  });

  // Chat 系统角色
  const chatSystemAdmin = await prisma.role.upsert({
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

  // ==================== 5. 为角色分配权限和菜单 ====================
  console.log('🔗 Assigning permissions and menus to roles...');

  // 后台管理系统管理员 - 拥有所有后台管理系统的权限
  const adminSystemPermissions = createdPermissions.filter(p =>
    p.code.startsWith('user:') || p.code.startsWith('role:') ||
    p.code.startsWith('permission:') || p.code.startsWith('system:') ||
    p.code.startsWith('menu:')
  );

  for (const permission of adminSystemPermissions) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: adminSystemAdmin.id, permissionId: permission.id } },
      update: {},
      create: { roleId: adminSystemAdmin.id, permissionId: permission.id },
    });
  }

  // 后台管理系统管理员 - 分配所有菜单
  const adminSystemMenus = [userMenu, roleMenu, permissionCenterMenu];
  for (const menu of adminSystemMenus) {
    await prisma.roleMenu.upsert({
      where: { roleId_menuId: { roleId: adminSystemAdmin.id, menuId: menu.id } },
      update: {},
      create: { roleId: adminSystemAdmin.id, menuId: menu.id },
    });
  }

  // Chat 系统管理员 - 分配所有 Chat 系统菜单
  for (const menu of chatMenus) {
    await prisma.roleMenu.upsert({
      where: { roleId_menuId: { roleId: chatSystemAdmin.id, menuId: menu.id } },
      update: {},
      create: { roleId: chatSystemAdmin.id, menuId: menu.id },
    });
  }

  // 内容管理系统管理员 - 拥有所有CMS权限
  const cmsPermissions = createdPermissions.filter(p => p.code.startsWith('article:') || p.code.startsWith('category:'));
  for (const permission of cmsPermissions) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: cmsSystemAdmin.id, permissionId: permission.id } },
      update: {},
      create: { roleId: cmsSystemAdmin.id, permissionId: permission.id },
    });
  }

  // CMS管理员 - 分配菜单
  await prisma.roleMenu.upsert({
    where: { roleId_menuId: { roleId: cmsSystemAdmin.id, menuId: articleMenu.id } },
    update: {},
    create: { roleId: cmsSystemAdmin.id, menuId: articleMenu.id },
  });
  await prisma.roleMenu.upsert({
    where: { roleId_menuId: { roleId: cmsSystemAdmin.id, menuId: categoryMenu.id } },
    update: {},
    create: { roleId: cmsSystemAdmin.id, menuId: categoryMenu.id },
  });

  // CMS编辑 - 只有部分权限
  const editorPermissions = createdPermissions.filter(p =>
    p.code === 'article:read' || p.code === 'article:create' ||
    p.code === 'article:update' || p.code === 'article:btn:create'
  );
  for (const permission of editorPermissions) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: cmsSystemEditor.id, permissionId: permission.id } },
      update: {},
      create: { roleId: cmsSystemEditor.id, permissionId: permission.id },
    });
  }

  // ==================== 6. 首页 Hero 精选位 ====================
  await seedFeaturedSlots(prisma);

  console.log('\n✅ Seed completed successfully!');
  console.log('\n📋 Created resources:');
  console.log(`   Systems: 3 (后台管理系统, 内容管理系统, Chat)`);
  console.log(`   Menus: ${adminSystemMenus.length + 2 + chatMenus.length}`);
  console.log(`   Permissions: ${createdPermissions.length}`);
  console.log(`   Roles: 6`);
  console.log('\n💡 超级管理员请通过 API 服务启动时按环境变量 SUPER_ADMIN_* 自动创建');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
