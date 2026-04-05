import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { DepartmentModule } from './department/department.module';
import { PermissionModule } from './permission/permission.module';
import { RoleModule } from './role/role.module';
import { MenuModule } from './menu/menu.module';
import { SessionModule } from './session/session.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UserModule,
    DepartmentModule,
    PermissionModule,
    RoleModule,
    MenuModule,
    SessionModule,
  ],
})
export class AppModule {}
