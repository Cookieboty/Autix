import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthIdentityRepository } from './auth-identity.repository';
import { MailService } from '../../platform/mail/mail.service';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

@Injectable()
export class EmailChangeService {
  constructor(
    private readonly identity: AuthIdentityRepository,
    private readonly mail: MailService,
    private readonly jwt: JwtService,
  ) {}

  async request(userId: string, email: string): Promise<void> {
    if (!EMAIL_RE.test(email)) throw new BadRequestException('邮箱格式不正确');
    const existing = await this.identity.findUserByEmail(email);
    if (existing && existing.id !== userId) throw new ConflictException('该邮箱已被使用');
    await this.identity.setPendingEmail(userId, email);
    const token = this.jwt.sign({ sub: userId, email, purpose: 'email-verify' }, { expiresIn: '1h' });
    await this.mail.sendEmailVerification(email, token);
  }

  async confirm(token: string): Promise<void> {
    let payload: { sub: string; email: string; purpose: string };
    try { payload = this.jwt.verify(token); } catch { throw new BadRequestException('验证链接已过期或无效'); }
    if (payload.purpose !== 'email-verify') throw new BadRequestException('无效的验证链接');
    const user = await this.identity.findUserById(payload.sub);
    if (!user) throw new BadRequestException('验证链接已过期或无效');
    if ((user as any).pendingEmail !== payload.email) throw new BadRequestException('验证链接已过期或无效');
    const existing = await this.identity.findUserByEmail(payload.email);
    if (existing && existing.id !== payload.sub) throw new ConflictException('该邮箱已被使用');
    try {
      await this.identity.applyVerifiedEmail(payload.sub, payload.email);
    } catch (err: any) {
      if (err?.code === 'P2002') throw new ConflictException('该邮箱已被使用');
      throw err;
    }
  }
}
