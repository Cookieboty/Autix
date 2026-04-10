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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DocumentService } from './document.service';
import { ChunkService } from './chunk.service';

const ALLOWED_MIME_TYPES = [
  'text/plain',
  'text/markdown',
  'application/pdf',
];

@UseGuards(JwtAuthGuard)
@Controller('api/documents')
export class DocumentController {
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
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const userId = (req.user as any).userId;
    return this.documentService.upload(userId, file);
  }

  @Post(':id/process')
  @HttpCode(HttpStatus.ACCEPTED)
  async process(@Req() req: Request, @Param('id') id: string) {
    const userId = (req.user as any).userId;
    await this.documentService.findById(id, userId);
    this.chunkService.processDocument(id).catch((err) => {
      console.error(`[DocumentProcess] documentId=${id} failed:`, err);
    });
    return { message: '处理已开始', documentId: id };
  }

  @Get()
  async findAll(@Req() req: Request) {
    const userId = (req.user as any).userId;
    return this.documentService.findByUser(userId);
  }

  @Get(':id')
  async findOne(@Req() req: Request, @Param('id') id: string) {
    const userId = (req.user as any).userId;
    return this.documentService.findById(id, userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Req() req: Request, @Param('id') id: string) {
    const userId = (req.user as any).userId;
    await this.documentService.delete(id, userId);
  }
}
