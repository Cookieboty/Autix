import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { UserRegistrationStatusSyncService } from './user-registration-status-sync.service';

@Module({
  controllers: [UserController],
  providers: [UserRegistrationStatusSyncService, UserService],
  exports: [UserService],
})
export class UserModule {}
