import { Module } from '@nestjs/common';
import { AdminBootstrapRepository } from './admin-bootstrap.repository';
import { AdminBootstrapService } from './admin-bootstrap.service';

@Module({
  providers: [AdminBootstrapRepository, AdminBootstrapService],
})
export class BootstrapModule {}
