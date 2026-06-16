import { Global, Module } from '@nestjs/common';
import { SystemSettingsModule } from '../system-settings/system-settings.module';
import { MailService } from './mail.service';

@Global()
@Module({
  imports: [SystemSettingsModule],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
