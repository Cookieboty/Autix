import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { UserRegistrationStatusSyncService } from './user-registration-status-sync.service';
import { UserRepository } from './user.repository';

@Module({
  controllers: [UserController],
  providers: [UserRegistrationStatusSyncService, UserRepository, UserService],
  exports: [UserService],
})
export class UserModule {}
