import {
  Controller,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CloudflareR2Service } from './cloudflare-r2.service';

@UseGuards(JwtAuthGuard)
@Controller('api/storage')
export class StorageController {
  constructor(private readonly r2: CloudflareR2Service) {}

  @Post('presign')
  async presign(
    @Body() body: { fileName: string; contentType: string; folder?: string },
  ) {
    return this.r2.createPresignedUpload({
      fileName: body.fileName,
      contentType: body.contentType,
      folder: body.folder,
    });
  }
}
