import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { PrismaService } from '../prisma/prisma.service';
import { RegistrationService } from '../registration/registration.service';

interface CheckAdminRequest {
  userId: string;
}

interface CheckAdminResponse {
  isAdmin: boolean;
  isSuperAdmin: boolean;
  roles: string[];
}

interface GetUserInfoRequest {
  userId: string;
}

interface GetUserInfoResponse {
  userId: string;
  username: string;
  email: string;
  isSuperAdmin: boolean;
  roles: string[];
}

interface ListUsersRequest {
  page: number;
  pageSize: number;
  search: string;
}

interface UserItem {
  userId: string;
  username: string;
  email: string;
  realName: string;
  status: string;
}

interface ListUsersResponse {
  users: UserItem[];
  total: number;
}

interface ApproveUserRequest {
  userId: string;
  adminUserId: string;
  note: string;
}

interface ApproveUserResponse {
  success: boolean;
  message: string;
}

interface ValidateSessionRequest {
  sessionId: string;
}

interface ValidateSessionResponse {
  valid: boolean;
  userId: string;
}

@Controller()
export class UserGrpcController {
  constructor(
    private prisma: PrismaService,
    private registrationService: RegistrationService,
  ) {}

  @GrpcMethod('UserService', 'CheckAdmin')
  async checkAdmin(data: CheckAdminRequest): Promise<CheckAdminResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: data.userId },
      include: {
        roles: {
          include: { role: true },
        },
      },
    });

    if (!user) {
      return { isAdmin: false, isSuperAdmin: false, roles: [] };
    }

    const roles = user.roles.map((ur) => ur.role.code);
    const isSuperAdmin = user.isSuperAdmin;
    const isAdmin = isSuperAdmin || roles.includes('SYSTEM_ADMIN');

    return { isAdmin, isSuperAdmin, roles };
  }

  @GrpcMethod('UserService', 'GetUserInfo')
  async getUserInfo(data: GetUserInfoRequest): Promise<GetUserInfoResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: data.userId },
      include: {
        roles: {
          include: { role: true },
        },
      },
    });

    if (!user) {
      return { userId: '', username: '', email: '', isSuperAdmin: false, roles: [] };
    }

    return {
      userId: user.id,
      username: user.username,
      email: user.email,
      isSuperAdmin: user.isSuperAdmin,
      roles: user.roles.map((ur) => ur.role.code),
    };
  }

  @GrpcMethod('UserService', 'ListUsers')
  async listUsers(data: ListUsersRequest): Promise<ListUsersResponse> {
    const page = data.page || 1;
    const pageSize = data.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where: any = {
      registrations: {
        some: {
          system: { code: 'chat' },
        },
      },
    };
    if (data.search) {
      where.AND = [
        {
          OR: [
            { username: { contains: data.search, mode: 'insensitive' } },
            { email: { contains: data.search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: {
          registrations: {
            where: { system: { code: 'chat' } },
            select: { status: true },
          },
        },
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      users: users.map((u) => ({
        userId: u.id,
        username: u.username,
        email: u.email,
        realName: u.realName || '',
        status: u.registrations[0]?.status ?? u.status,
      })),
      total,
    };
  }

  @GrpcMethod('UserService', 'ApproveUser')
  async approveUser(data: ApproveUserRequest): Promise<ApproveUserResponse> {
    const registration = await this.prisma.systemRegistration.findFirst({
      where: {
        userId: data.userId,
        system: { code: 'chat' },
        status: 'PENDING',
      },
    });

    if (!registration) {
      return { success: false, message: '无待审批的注册申请' };
    }

    const adminUser = await this.prisma.user.findUnique({
      where: { id: data.adminUserId },
    });
    if (!adminUser) {
      return { success: false, message: '管理员用户不存在' };
    }

    await this.registrationService.approve(
      registration.id,
      { id: adminUser.id, isSuperAdmin: adminUser.isSuperAdmin } as any,
      { note: data.note || '通过 chat 管理后台审批' },
    );

    return { success: true, message: '审批通过' };
  }

  @GrpcMethod('UserService', 'ValidateSession')
  async validateSession(data: ValidateSessionRequest): Promise<ValidateSessionResponse> {
    if (!data.sessionId) {
      return { valid: false, userId: '' };
    }

    const session = await this.prisma.userSession.findUnique({
      where: { id: data.sessionId },
      include: { user: { select: { id: true, status: true } } },
    });

    if (
      !session ||
      session.expiresAt < new Date() ||
      session.user.status !== 'ACTIVE'
    ) {
      return { valid: false, userId: '' };
    }

    return { valid: true, userId: session.user.id };
  }
}
