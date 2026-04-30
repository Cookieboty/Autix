import { Module } from '@nestjs/common';
import { AmuxProxyController } from './amux-proxy.controller';
import { AmuxCredentialService } from './amux-credential.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AmuxProxyController],
  providers: [AmuxCredentialService],
})
export class AmuxProxyModule {}
