import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Request } from 'express';
import { JwtAuthGuard } from '../../identity/auth/jwt-auth.guard';
import { CurrentUser, getCurrentUserId } from '../../identity/auth/decorators/current-user.decorator';
import { MembershipGuard } from '../../identity/auth/membership.guard';
import { DocumentService } from './document.service';
import { ChunkService } from './chunk.service';
import { ALLOWED_MIME_TYPES } from './document.constants';
import { LibraryFeatureGuard } from './library-feature.guard';
import type { AuthUser } from '@autix/types';

type DocumentUploadRequest = Request<unknown, unknown, { filename?: string }>;

@UseGuards(JwtAuthGuard, LibraryFeatureGuard, MembershipGuard)
@Controller('documents')
export class DocumentController {
  private readonly logger = new Logger(DocumentController.name);

  constructor(
    private readonly documentService: DocumentService,
    private readonly chunkService: ChunkService,
  ) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestException(`不支持的文件类型：${file.mimetype}`), false);
        }
      },
    }),
  )
  async upload(
    @CurrentUser() user: AuthUser,
    @Req() req: DocumentUploadRequest,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const userId = getCurrentUserId(user);
    // filename sent as separate FormData field to avoid UTF-8 multipart encoding issues
    const filename = req.body.filename || file.originalname;
    return this.documentService.upload(userId, file, filename);
  }

  @Post(':id/process')
  @HttpCode(HttpStatus.ACCEPTED)
  async process(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const userId = getCurrentUserId(user);
    await this.documentService.findById(id, userId);
    this.chunkService.processDocument(id, userId).catch((err) => {
      this.logger.error(
        `Document processing failed: documentId=${id}`,
        err instanceof Error ? err.stack : String(err),
      );
    });
    return { message: '处理已开始', documentId: id };
  }

  @Get()
  async findAll(@CurrentUser() user: AuthUser) {
    const userId = getCurrentUserId(user);
    return this.documentService.findByUser(userId);
  }

  @Get(':id')
  async findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const userId = getCurrentUserId(user);
    return this.documentService.findById(id, userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const userId = getCurrentUserId(user);
    await this.documentService.delete(id, userId);
  }
}
