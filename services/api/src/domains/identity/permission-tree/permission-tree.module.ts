import { Module } from '@nestjs/common';
import { PermissionTreeController } from './permission-tree.controller';
import { PermissionTreeService } from './permission-tree.service';
import { PermissionTreeRepository } from './permission-tree.repository';

@Module({
  controllers: [PermissionTreeController],
  providers: [PermissionTreeRepository, PermissionTreeService],
  exports: [PermissionTreeService],
})
export class PermissionTreeModule {}
