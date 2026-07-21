import { Module } from '@nestjs/common';
import { PrismaModule } from '../../platform/prisma/prisma.module';
import { FavoriteLibraryService } from './favorite-library.service';

/**
 * FavoriteLibraryService 只依赖数据库客户端（叶子服务），拆成独立小模块方便
 * gallery / marketplace(image-templates, video-templates) 等跨域模块直接导入，
 * 不必连带拉入 MaterialsModule 的 StorageModule 等依赖。
 */
@Module({
  imports: [PrismaModule],
  providers: [FavoriteLibraryService],
  exports: [FavoriteLibraryService],
})
export class FavoriteLibraryModule {}
