import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { PermissionModule } from './permission/permission.module';
import { RoleModule } from './role/role.module';
import { MenuModule } from './menu/menu.module';
import { SessionModule } from './session/session.module';
import { SystemModule } from './system/system.module';
import { PermissionTreeModule } from './permission-tree/permission-tree.module';
import { RegistrationModule } from './registration/registration.module';
import { GrpcModule } from './grpc/grpc.module';
import { I18nModule } from './i18n/i18n.module';
import { I18nMiddleware } from './i18n/i18n.middleware';

@Module({
  imports: [
    I18nModule,
    PrismaModule,
    AuthModule,
    UserModule,
    PermissionModule,
    RoleModule,
    MenuModule,
    SessionModule,
    SystemModule,
    PermissionTreeModule,
    RegistrationModule,
    GrpcModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(I18nMiddleware).forRoutes('*');
  }
}
