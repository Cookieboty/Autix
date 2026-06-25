import { forwardRef, Module } from '@nestjs/common';
import { RegistrationController } from './registration.controller';
import { RegistrationRepository } from './registration.repository';
import { RegistrationService } from './registration.service';
import { MailModule } from '../../platform/mail/mail.module';
import { InviteModule } from '../../billing/invite/invite.module';

@Module({
  imports: [MailModule, forwardRef(() => InviteModule)],
  controllers: [RegistrationController],
  providers: [RegistrationRepository, RegistrationService],
  exports: [RegistrationService],
})
export class RegistrationModule {}
