import { getDatabaseUrl, PrismaClient, type Prisma } from '@autix/database';
import { PrismaPg } from '@prisma/adapter-pg';
import { CHAT_MENU_DEFS } from './seeds/chat-menus';

/**
 * 生产环境 seed：每次 API 启动时执行，必须幂等。
 *
 * 灌的内容（保持最小集，只满足超级管理员可用 + chat 服务依赖）：
 *   - System: admin-system, chat
 *   - Menu:  admin-system 下的 3 个（用户管理 / 角色管理 / 权限配置中心）
 *            + chat 系统下的 15 个，定义于 ./seeds/chat-menus（与 seed.ts 共用同一
 *              份 CHAT_MENU_DEFS，不再各自维护一份拷贝）
 *   - Permission: admin-system 菜单关联的 BACKEND/FRONTEND 权限点
 *              + chat 系统 generation-tasks 菜单的 generation:view / generation:view-content
 *   - Role:  chat 系统的 SYSTEM_ADMIN / USER（注册审批流程依赖）
 *   - RoleMenu: chat SYSTEM_ADMIN ↔ chat 系统全部菜单（非超管管理员靠这个才能在侧边栏看到菜单）
 *   - RolePermission: chat SYSTEM_ADMIN ↔ generation:* 两条权限（非超管调用生成任务接口需要）
 *
 * 不灌：cms-system、admin-system 的角色、admin-system 的 role-permission / role-menu 关联。
 * 超管登录看菜单/权限不依赖角色（menu.service.ts、PermissionsGuard 对 isSuperAdmin 直接放行）。
 */
const adapter = new PrismaPg({
  connectionString: getDatabaseUrl(),
});
const prisma = new PrismaClient({ adapter });

const DEFAULT_REWARD_USAGE_SCOPE: Prisma.InputJsonValue = {
  excludedTaskTypes: ['video_generation'],
};

type FixedCampaignSeed = {
  code: string;
  name: string;
  description: string;
  type: 'INVITATION' | 'REGISTRATION' | 'QUEST';
  status: 'ACTIVE' | 'PAUSED';
  rewardPoints: number;
  rewardExpiresInDays: number;
  metadata: Prisma.InputJsonValue;
  rewardUsageScope?: Prisma.InputJsonValue | null;
};

const FIXED_CAMPAIGN_SEEDS: FixedCampaignSeed[] = [
  {
    code: 'INVITATION_REWARD',
    name: '邀请奖励',
    description: '邀请好友注册并完成激活后发放奖励。',
    type: 'INVITATION',
    status: 'ACTIVE',
    rewardPoints: 100,
    rewardExpiresInDays: 7,
    metadata: {
      fixed: true,
      builtin: true,
      maxRewardedInvitesPerInviter: 50,
      velocityThreshold: 20,
    },
  },
  {
    code: 'REGISTRATION_BONUS',
    name: '注册奖励',
    description: '新用户完成注册后发放的欢迎奖励，默认关闭。',
    type: 'REGISTRATION',
    status: 'PAUSED',
    rewardPoints: 0,
    rewardExpiresInDays: 7,
    metadata: {
      fixed: true,
      builtin: true,
      grantOn: ['email_activation', 'oauth_first_login'],
      onlyFirstRegistration: true,
    },
  },
  {
    code: 'HOME_QUEST_NANO_BANANA_PRO',
    name: '首页任务：Nano Banana Pro',
    description: '完成 Nano Banana Pro 图片生成后领取奖励。',
    type: 'QUEST',
    status: 'ACTIVE',
    rewardPoints: 50,
    rewardExpiresInDays: 7,
    metadata: {
      fixed: true,
      builtin: true,
      questCode: 'HOME_QUEST_NANO_BANANA_PRO',
      completionKind: 'IMAGE_GENERATION_MODEL',
      modelMatchers: ['nano-banana-pro'],
      titleI18nKey: 'onboardTryModel',
      subtitleI18nKey: 'onboardSubBestImage',
      ctaI18nKey: 'onboardCtaTry',
      modelLabel: 'Nano Banana Pro',
      hrefPath: '/ai/image',
      sortOrder: 1,
    },
  },
  {
    code: 'HOME_QUEST_SEEDANCE',
    name: '首页任务：Seedance',
    description: '完成 Seedance 视频生成后领取奖励。',
    type: 'QUEST',
    status: 'ACTIVE',
    rewardPoints: 80,
    rewardExpiresInDays: 7,
    metadata: {
      fixed: true,
      builtin: true,
      questCode: 'HOME_QUEST_SEEDANCE',
      completionKind: 'VIDEO_GENERATION_MODEL',
      modelMatchers: ['seedance'],
      titleI18nKey: 'onboardExploreModel',
      subtitleI18nKey: 'onboardSubBestVideo',
      ctaI18nKey: 'onboardCtaExplore',
      modelLabel: 'Seedance 2.0',
      hrefPath: '/ai/video',
      sortOrder: 2,
    },
  },
  {
    code: 'HOME_QUEST_MARKETING',
    name: '首页任务：Marketing Studio',
    description: '营销创作工作流恢复后可启用此任务。',
    type: 'QUEST',
    status: 'PAUSED',
    rewardPoints: 20,
    rewardExpiresInDays: 7,
    metadata: {
      fixed: true,
      builtin: true,
      questCode: 'HOME_QUEST_MARKETING',
      completionKind: 'MARKETING_WORKFLOW',
      titleI18nKey: 'onboardExploreModel',
      subtitleI18nKey: 'onboardSubPromptCampaign',
      ctaI18nKey: 'onboardCtaExplore',
      modelLabel: 'Marketing Studio',
      hrefPath: '/ai/image',
      sortOrder: 3,
    },
  },
];

async function seedFixedCampaigns() {
  for (const def of FIXED_CAMPAIGN_SEEDS) {
    await prisma.campaigns.upsert({
      where: { code: def.code },
      update: {},
      create: {
        code: def.code,
        name: def.name,
        description: def.description,
        type: def.type,
        status: def.status,
        rewardGrantType: 'GIFT',
        rewardSourceEvent: 'campaign_bonus',
        rewardPointsExpression: { fixed: def.rewardPoints },
        rewardExpiresInDays: def.rewardExpiresInDays,
        rewardUsageScope: def.rewardUsageScope ?? DEFAULT_REWARD_USAGE_SCOPE,
        metadata: def.metadata,
      },
    });
  }
}

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

  // ── 4. chat 系统的菜单（单一来源见 ./seeds/chat-menus，勿再复制一份定义） ─
  const chatMenus: { id: string }[] = [];
  let generationTasksMenu: { id: string } | undefined;
  for (const def of CHAT_MENU_DEFS) {
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
    if (def.code === 'generation-tasks') generationTasksMenu = m;
  }
  if (!generationTasksMenu) {
    throw new Error('Seed error: generation-tasks menu was not created');
  }

  // ── 3b. generation-tasks 菜单的权限点（chat 系统，非 admin-system） ──────
  // menuId 需在上面的 chat 菜单循环之后才能拿到，所以单独放一段，字段口径与
  // seed.ts 的 generationTaskPermissions 完全一致。
  const generationTaskPermissions: Array<{
    menuId: string;
    name: string;
    code: string;
    type: 'BACKEND' | 'FRONTEND';
    action: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'EXPORT';
  }> = [
      { menuId: generationTasksMenu.id, name: '查看生成任务', code: 'generation:view', type: 'BACKEND', action: 'READ' },
      { menuId: generationTasksMenu.id, name: '查看生成内容（prompt/参数快照/上游原文）', code: 'generation:view-content', type: 'BACKEND', action: 'READ' },
    ];

  const generationTaskPermissionRecords: { id: string }[] = [];
  for (const p of generationTaskPermissions) {
    const permission = await prisma.permission.upsert({
      where: { code: p.code },
      update: {},
      create: p,
    });
    generationTaskPermissionRecords.push(permission);
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

  // ── 7. chat SYSTEM_ADMIN 角色 ↔ generation:* 权限关联 ───────────────────
  // 菜单可见性（roleMenu）不等于接口可调用性：PermissionsGuard 对非超管校验
  // user.permissions.includes(code)，不建这条关联的话普通管理员能看见
  // “生成任务”菜单、点进去调接口会 403。
  for (const permission of generationTaskPermissionRecords) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: chatAdminRole.id, permissionId: permission.id } },
      update: {},
      create: { roleId: chatAdminRole.id, permissionId: permission.id },
    });
  }

  await seedFixedCampaigns();

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
