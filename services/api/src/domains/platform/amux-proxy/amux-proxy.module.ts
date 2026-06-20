import { Module } from '@nestjs/common';
import { AmuxProxyController } from './amux-proxy.controller';
import { AmuxCredentialService } from './amux-credential.service';
import { PrismaModule } from '../prisma/prisma.module';
import { SystemSettingsModule } from '../system-settings/system-settings.module';

@Module({
  imports: [PrismaModule, SystemSettingsModule],
  controllers: [AmuxProxyController],
  providers: [AmuxCredentialService],
})
export class AmuxProxyModule {}
