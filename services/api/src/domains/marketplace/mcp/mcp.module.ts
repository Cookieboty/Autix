import { Module } from '@nestjs/common';
import { PrismaModule } from '../../platform/prisma/prisma.module';
import { AuthModule } from '../../identity/auth/auth.module';
import { CommonModule } from '../../platform/common/common.module';
import { MarketplaceResourceCrudRepository } from '../marketplace-resource-crud.repository';
import { McpService } from './mcp.service';
import { McpController, McpAdminController } from './mcp.controller';

@Module({
  imports: [PrismaModule, AuthModule, CommonModule],
  controllers: [McpController, McpAdminController],
  providers: [McpService, MarketplaceResourceCrudRepository],
  exports: [McpService],
})
export class McpModule {}
