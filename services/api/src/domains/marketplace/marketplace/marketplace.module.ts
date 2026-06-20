import { Module } from '@nestjs/common';
import { PrismaModule } from '../../platform/prisma/prisma.module';
import { AuthModule } from '../../identity/auth/auth.module';
import { AcquisitionsModule } from '../acquisitions/acquisitions.module';
import { MarketplaceService } from './marketplace.service';
import {
  MarketplaceController,
  MeController,
} from './marketplace.controller';

@Module({
  imports: [PrismaModule, AuthModule, AcquisitionsModule],
  controllers: [MarketplaceController, MeController],
  providers: [MarketplaceService],
  exports: [MarketplaceService],
})
export class MarketplaceModule {}
