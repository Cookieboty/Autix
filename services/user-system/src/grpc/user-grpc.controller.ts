import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { PrismaService } from '../prisma/prisma.service';

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

@Controller()
export class UserGrpcController {
  constructor(private prisma: PrismaService) {}

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
}
