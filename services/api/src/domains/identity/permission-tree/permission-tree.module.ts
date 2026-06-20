import { Module } from '@nestjs/common';
import { PermissionTreeController } from './permission-tree.controller';
import { PermissionTreeService } from './permission-tree.service';
import { PrismaModule } from '../../platform/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PermissionTreeController],
  providers: [PermissionTreeService],
  exports: [PermissionTreeService],
})
export class PermissionTreeModule {}
