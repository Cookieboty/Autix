import { Module } from '@nestjs/common';
import { RegistrationController } from './registration.controller';
import { RegistrationService } from './registration.service';
import { InviteModule } from '../invite/invite.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [InviteModule, MailModule],
  controllers: [RegistrationController],
  providers: [RegistrationService],
  exports: [RegistrationService],
})
export class RegistrationModule {}
