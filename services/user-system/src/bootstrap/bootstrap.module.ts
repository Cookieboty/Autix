import { Module } from '@nestjs/common';
import { AdminBootstrapService } from './admin-bootstrap.service';

@Module({
  providers: [AdminBootstrapService],
})
export class BootstrapModule {}
