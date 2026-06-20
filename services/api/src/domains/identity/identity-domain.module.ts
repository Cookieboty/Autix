import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { BootstrapModule } from './bootstrap/bootstrap.module';
import { MenuModule } from './menu/menu.module';
import { PermissionModule } from './permission/permission.module';
import { PermissionTreeModule } from './permission-tree/permission-tree.module';
import { RegistrationModule } from './registration/registration.module';
import { RoleModule } from './role/role.module';
import { SessionModule } from './session/session.module';
import { SystemModule } from './system/system.module';
import { UserModule } from './user/user.module';

@Module({
  imports: [
    AuthModule,
    UserModule,
    PermissionModule,
    RoleModule,
    MenuModule,
    SessionModule,
    SystemModule,
    PermissionTreeModule,
    RegistrationModule,
    BootstrapModule,
  ],
  exports: [
    AuthModule,
    UserModule,
    PermissionModule,
    RoleModule,
    MenuModule,
    SessionModule,
    SystemModule,
    PermissionTreeModule,
    RegistrationModule,
    BootstrapModule,
  ],
})
export class IdentityDomainModule {}
