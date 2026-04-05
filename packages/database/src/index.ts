export { 
  PrismaClient, 
  Prisma, 
  UserStatus, 
  PermissionAction, 
  PermissionType,
  SystemStatus,
  ClientStatus,
} from '@prisma/client';
export type {
  User, Department, Role, Permission, Menu,
  UserRole, RolePermission, RoleMenu, UserSession,
} from '@prisma/client';
