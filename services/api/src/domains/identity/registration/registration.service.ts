import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { MailService } from '../../platform/mail/mail.service';
import { AuthUser, MessageResponse } from '@autix/domain';
import { ProcessRegistrationDto } from './dto/process-registration.dto';
import { Prisma } from '../../platform/prisma/generated';
import { RegistrationRepository } from './registration.repository';
import { InviteService } from '../../billing/invite/invite.service';

@Injectable()
export class RegistrationService {
  private readonly logger = new Logger(RegistrationService.name);

  constructor(
    private registrationRepository: RegistrationRepository,
    private mailService: MailService,
    private inviteService: InviteService,
  ) {}

  private async assertSystemAdminAccess(user: AuthUser, systemId: string): Promise<void> {
    if (user.isSuperAdmin) return;
    const userRole = await this.registrationRepository.findSystemAdminRole(
      user.id,
      systemId,
    );
    if (!userRole) {
      throw new ForbiddenException('无权操作此系统的注册申请');
    }
  }

  async findAll(user: AuthUser, systemId?: string, status?: string) {
    let systemFilter: Prisma.SystemRegistrationWhereInput | undefined;
    if (systemId) {
      await this.assertSystemAdminAccess(user, systemId);
      systemFilter = { systemId };
    } else if (!user.isSuperAdmin) {
      const adminRoles = await this.registrationRepository.findSystemAdminRoles(user.id);
      const systemIds = adminRoles.map((ur) => ur.role.systemId);
      systemFilter = { systemId: { in: systemIds } };
    }

    return this.registrationRepository.findRegistrations(systemFilter, status);
  }

  async approve(
    id: string,
    user: AuthUser,
    dto: ProcessRegistrationDto,
  ): Promise<MessageResponse> {
    const registration = await this.registrationRepository.findById(id);
    if (!registration) throw new NotFoundException('注册申请不存在');
    if (registration.status !== 'PENDING') {
      throw new BadRequestException('该申请已处理');
    }

    await this.assertSystemAdminAccess(user, registration.systemId);

    const userRole = await this.registrationRepository.findRoleBySystemAndCode(
      registration.systemId,
      'USER',
    );

    if (!userRole) {
      throw new BadRequestException('该系统未配置默认用户角色(USER)，无法完成审批');
    }

    await this.registrationRepository.approveRegistration({
      id,
      userId: registration.userId,
      roleId: userRole.id,
      note: dto.note,
      processedById: user.id,
    });

    // FIX-2: 管理员审批通过后结算邀请奖励（best-effort，失败不影响审批）。
    try {
      await this.inviteService.settlePendingInvitationReward(registration.userId);
    } catch (err) {
      this.logger.error(
        `Failed to settle invitation reward: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const approvedUser = await this.registrationRepository.findApprovalEmailUser(
      registration.userId,
    );
    if (approvedUser?.email) {
      this.mailService.sendApprovalEmail(approvedUser.email, approvedUser.username).catch(() => {});
    }

    return { message: '审批通过' };
  }

  async reject(
    id: string,
    user: AuthUser,
    dto: ProcessRegistrationDto,
  ): Promise<MessageResponse> {
    const registration = await this.registrationRepository.findById(id);
    if (!registration) throw new NotFoundException('注册申请不存在');
    if (registration.status !== 'PENDING') {
      throw new BadRequestException('该申请已处理');
    }

    await this.assertSystemAdminAccess(user, registration.systemId);

    await this.registrationRepository.rejectRegistration({
      id,
      userId: registration.userId,
      note: dto.note,
      processedById: user.id,
    });

    return { message: '已拒绝' };
  }

  async getPendingCount(user: AuthUser): Promise<number> {
    if (user.isSuperAdmin) {
      return this.registrationRepository.count({ status: 'PENDING' });
    }
    const adminRoles = await this.registrationRepository.findSystemAdminRoles(user.id);
    const systemIds = adminRoles.map((ur) => ur.role.systemId);
    return this.registrationRepository.count({
      status: 'PENDING',
      systemId: { in: systemIds },
    });
  }
}
