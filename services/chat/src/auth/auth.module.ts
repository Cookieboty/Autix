import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join, dirname } from 'path';
import { JwtStrategy } from './jwt.strategy';
import { UserRpcService } from './user-rpc.service';
import { AdminGuard } from './admin.guard';
import { USER_GRPC_CLIENT, USER_GRPC_PACKAGE } from '@autix/contracts';

const USER_PROTO_PATH = join(
  dirname(require.resolve('@autix/contracts/package.json')),
  'proto/user.proto',
);

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
    }),
    ClientsModule.register([
      {
        name: USER_GRPC_CLIENT,
        transport: Transport.GRPC,
        options: {
          package: USER_GRPC_PACKAGE,
          protoPath: USER_PROTO_PATH,
          url: process.env.USER_GRPC_URL || 'localhost:50051',
        },
      },
    ]),
  ],
  providers: [JwtStrategy, UserRpcService, AdminGuard],
  exports: [JwtModule, UserRpcService, AdminGuard],
})
export class AuthModule {}
