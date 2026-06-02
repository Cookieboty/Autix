import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';
import { McpService } from './mcp.service';
import { McpController, McpAdminController } from './mcp.controller';

@Module({
  imports: [PrismaModule, AuthModule, CommonModule],
  controllers: [McpController, McpAdminController],
  providers: [McpService],
  exports: [McpService],
})
export class McpModule {}
