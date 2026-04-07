import { Module } from '@nestjs/common';
import { RegistrationController } from './registration.controller';
import { RegistrationService } from './registration.service';

@Module({
  controllers: [RegistrationController],
  providers: [RegistrationService],
})
export class RegistrationModule {}
