import { Module } from '@nestjs/common';
import { PrismaModule } from '../../platform/prisma/prisma.module';
import { GalleryModule } from '../gallery/gallery.module';
import { PublicProfileController } from './public-profile.controller';
import { PublicProfileService } from './public-profile.service';

/**
 * `/@username` 公开个人页模块。依赖 GalleryModule（作者 feed + 统计），用户基础字段读 Prisma。
 * 无反向依赖 UserModule，故不构成 DI 环（GalleryModule → AuthModule，不回指 profile）。
 */
@Module({
  imports: [PrismaModule, GalleryModule],
  controllers: [PublicProfileController],
  providers: [PublicProfileService],
})
export class PublicProfileModule {}
