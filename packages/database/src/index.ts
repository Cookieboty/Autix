export {
  PrismaClient,
  Prisma,
  UserStatus,
  PermissionAction,
  PermissionType,
  SystemStatus,
  ClientStatus,
  RegistrationStatus,
} from '@prisma/client';
export type {
  User, Department, Role, Permission, Menu,
  UserRole, RolePermission, RoleMenu, UserSession,
  SystemRegistration,
} from '@prisma/client';
