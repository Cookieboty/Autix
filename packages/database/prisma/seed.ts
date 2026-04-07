import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');
  const hashedPassword = await bcrypt.hash('Admin@123456', 10);

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
    update: {},
    create: {
      systemId: adminSystem.id,
      name: '用户管理',
      code: 'user-management',
      path: '/users',
      icon: 'Users',
      sort: 1,
      visible: true,
    },
  });

  const departmentMenu = await prisma.menu.upsert({
    where: { systemId_code: { systemId: adminSystem.id, code: 'department-management' } },
    update: { sort: 2 },
    create: {
      systemId: adminSystem.id,
      name: '部门管理',
      code: 'department-management',
      path: '/departments',
      icon: 'Building',
      sort: 2,
      visible: true,
    },
  });

  const roleMenu = await prisma.menu.upsert({
    where: { systemId_code: { systemId: adminSystem.id, code: 'role-management' } },
    update: { sort: 3 },
    create: {
      systemId: adminSystem.id,
      name: '角色管理',
      code: 'role-management',
      path: '/roles',
      icon: 'Shield',
      sort: 3,
      visible: true,
    },
  });

  const permissionCenterMenu = await prisma.menu.upsert({
    where: { systemId_code: { systemId: adminSystem.id, code: 'permission-center' } },
    update: { sort: 4 },
    create: {
      systemId: adminSystem.id,
      name: '权限配置中心',
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
    update: {},
    create: {
      systemId: cmsSystem.id,
      name: '文章管理',
      code: 'article-management',
      path: '/articles',
      icon: 'FileText',
      sort: 1,
      visible: true,
    },
  });

  const categoryMenu = await prisma.menu.upsert({
    where: { systemId_code: { systemId: cmsSystem.id, code: 'category-management' } },
    update: {},
    create: {
      systemId: cmsSystem.id,
      name: '分类管理',
      code: 'category-management',
      path: '/categories',
      icon: 'Folder',
      sort: 2,
      visible: true,
    },
  });

  // ==================== 3. 创建权限点 ====================
  console.log('🔐 Creating permissions...');
  
  // 用户管理权限
  const userPermissions = [
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

  // 部门管理权限
  const departmentPermissions = [
    { menu: departmentMenu, name: '创建部门', code: 'department:create', type: 'BACKEND', action: 'CREATE' },
    { menu: departmentMenu, name: '查看部门', code: 'department:read', type: 'BACKEND', action: 'READ' },
    { menu: departmentMenu, name: '更新部门', code: 'department:update', type: 'BACKEND', action: 'UPDATE' },
    { menu: departmentMenu, name: '删除部门', code: 'department:delete', type: 'BACKEND', action: 'DELETE' },
  ];

  // 角色管理权限
  const rolePermissions = [
    { menu: roleMenu, name: '创建角色', code: 'role:create', type: 'BACKEND', action: 'CREATE' },
    { menu: roleMenu, name: '查看角色', code: 'role:read', type: 'BACKEND', action: 'READ' },
    { menu: roleMenu, name: '更新角色', code: 'role:update', type: 'BACKEND', action: 'UPDATE' },
    { menu: roleMenu, name: '删除角色', code: 'role:delete', type: 'BACKEND', action: 'DELETE' },
    { menu: roleMenu, name: '新增按钮', code: 'role:btn:create', type: 'FRONTEND', action: 'CREATE' },
    { menu: roleMenu, name: '编辑按钮', code: 'role:btn:edit', type: 'FRONTEND', action: 'UPDATE' },
  ];

  // 权限配置中心权限（整合系统、菜单、权限管理）
  const permissionCenterPermissions = [
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
  const articlePermissions = [
    { menu: articleMenu, name: '创建文章', code: 'article:create', type: 'BACKEND', action: 'CREATE' },
    { menu: articleMenu, name: '查看文章', code: 'article:read', type: 'BACKEND', action: 'READ' },
    { menu: articleMenu, name: '更新文章', code: 'article:update', type: 'BACKEND', action: 'UPDATE' },
    { menu: articleMenu, name: '删除文章', code: 'article:delete', type: 'BACKEND', action: 'DELETE' },
    { menu: articleMenu, name: '发布文章', code: 'article:publish', type: 'BACKEND', action: 'UPDATE' },
    { menu: articleMenu, name: '新增按钮', code: 'article:btn:create', type: 'FRONTEND', action: 'CREATE' },
  ];

  // 分类管理权限（CMS系统）
  const categoryPermissions = [
    { menu: categoryMenu, name: '创建分类', code: 'category:create', type: 'BACKEND', action: 'CREATE' },
    { menu: categoryMenu, name: '查看分类', code: 'category:read', type: 'BACKEND', action: 'READ' },
    { menu: categoryMenu, name: '更新分类', code: 'category:update', type: 'BACKEND', action: 'UPDATE' },
    { menu: categoryMenu, name: '删除分类', code: 'category:delete', type: 'BACKEND', action: 'DELETE' },
  ];

  const allPermissions = [
    ...userPermissions,
    ...departmentPermissions,
    ...rolePermissions,
    ...permissionCenterPermissions,
    ...articlePermissions,
    ...categoryPermissions,
  ];

  const createdPermissions: any[] = [];
  for (const perm of allPermissions) {
    const permission = await prisma.permission.upsert({
      where: { code: perm.code },
      update: {},
      create: {
        menuId: perm.menu.id,
        name: perm.name,
        code: perm.code,
        type: perm.type as any,
        action: perm.action as any,
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

  const adminSystemUser = await prisma.role.upsert({
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

  const chatSystemUser = await prisma.role.upsert({
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
  const adminSystemMenus = [userMenu, departmentMenu, roleMenu, permissionCenterMenu];
  for (const menu of adminSystemMenus) {
    await prisma.roleMenu.upsert({
      where: { roleId_menuId: { roleId: adminSystemAdmin.id, menuId: menu.id } },
      update: {},
      create: { roleId: adminSystemAdmin.id, menuId: menu.id },
    });
  }

  // 内容管理系统管理员 - 拥有所有CMS权限
  const cmsPermissions = createdPermissions.filter(p => p.code.startsWith('article:'));
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

  // ==================== 6. 创建部门 ====================
  console.log('🏢 Creating departments...');

  const techDept = await prisma.department.upsert({
    where: { code: 'tech' },
    update: {},
    create: {
      name: '技术部',
      code: 'tech',
      description: '负责产品研发和技术支持',
      sort: 1,
    },
  });

  const frontendDept = await prisma.department.upsert({
    where: { code: 'frontend' },
    update: {},
    create: {
      name: '前端组',
      code: 'frontend',
      description: '负责前端开发',
      parentId: techDept.id,
      sort: 1,
    },
  });

  const backendDept = await prisma.department.upsert({
    where: { code: 'backend' },
    update: {},
    create: {
      name: '后端组',
      code: 'backend',
      description: '负责后端开发',
      parentId: techDept.id,
      sort: 2,
    },
  });

  const productDept = await prisma.department.upsert({
    where: { code: 'product' },
    update: {},
    create: {
      name: '产品部',
      code: 'product',
      description: '负责产品设计和规划',
      sort: 2,
    },
  });

  const operationsDept = await prisma.department.upsert({
    where: { code: 'operations' },
    update: {},
    create: {
      name: '运营部',
      code: 'operations',
      description: '负责内容运营和用户增长',
      sort: 3,
    },
  });

  // ==================== 7. 创建用户 ====================
  console.log('👤 Creating users...');
  
  // 超级管理员
  const superAdmin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@example.com',
      password: hashedPassword,
      realName: '超级管理员',
      status: 'ACTIVE',
      isSuperAdmin: true,
      departmentId: techDept.id,
    },
  });

  // 跨系统用户 - 张三
  const zhangsan = await prisma.user.upsert({
    where: { username: 'zhangsan' },
    update: {},
    create: {
      username: 'zhangsan',
      email: 'zhangsan@example.com',
      password: hashedPassword,
      realName: '张三',
      status: 'ACTIVE',
      isSuperAdmin: false,
      departmentId: frontendDept.id,
    },
  });

  // 普通用户 - 李四（只在CMS系统）
  const lisi = await prisma.user.upsert({
    where: { username: 'lisi' },
    update: {},
    create: {
      username: 'lisi',
      email: 'lisi@example.com',
      password: hashedPassword,
      realName: '李四',
      status: 'ACTIVE',
      isSuperAdmin: false,
      departmentId: operationsDept.id,
    },
  });

  // ==================== 7. 为用户分配角色 ====================
  console.log('🎭 Assigning roles to users...');
  
  // 张三：在后台管理系统是管理员，在CMS系统是编辑
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: zhangsan.id, roleId: adminSystemAdmin.id } },
    update: {},
    create: { userId: zhangsan.id, roleId: adminSystemAdmin.id },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: zhangsan.id, roleId: cmsSystemEditor.id } },
    update: {},
    create: { userId: zhangsan.id, roleId: cmsSystemEditor.id },
  });

  // 李四：只在CMS系统是内容管理员
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: lisi.id, roleId: cmsSystemAdmin.id } },
    update: {},
    create: { userId: lisi.id, roleId: cmsSystemAdmin.id },
  });

  // ==================== 8. 创建OAuth2客户端示例 ====================
  console.log('🔑 Creating OAuth2 clients...');
  
  const oauthClient = await prisma.oAuthClient.upsert({
    where: { clientId: 'test-client-001' },
    update: {},
    create: {
      clientId: 'test-client-001',
      clientSecret: await bcrypt.hash('test-secret', 10),
      name: '测试应用',
      description: '用于测试的OAuth2客户端',
      redirectUris: ['http://localhost:3001/callback', 'http://localhost:3002/callback'],
      grantTypes: ['authorization_code', 'refresh_token'],
      scopes: ['user:read', 'system:access'],
      systemId: adminSystem.id,
      status: 'ACTIVE',
    },
  });

  console.log('\n✅ Seed completed successfully!');
  console.log('\n📋 Created resources:');
  console.log(`   Systems: 3 (后台管理系统, 内容管理系统, Chat)`);
  console.log(`   Menus: ${adminSystemMenus.length + 2}`);
  console.log(`   Permissions: ${createdPermissions.length}`);
  console.log(`   Roles: 6`);
  console.log(`   Departments: 5`);
  console.log(`   Users: 3`);
  console.log(`   OAuth2 Clients: 1`);
  console.log('\n👤 Login credentials:');
  console.log(`   超级管理员: admin / Admin@123456`);
  console.log(`   跨系统用户: zhangsan / Admin@123456`);
  console.log(`   CMS管理员: lisi / Admin@123456`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
