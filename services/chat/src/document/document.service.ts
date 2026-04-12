import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import { ALLOWED_MIME_TYPES } from './document.constants';

@Injectable()
export class DocumentService {
  constructor(private readonly prisma: PrismaService) { }

  async upload(userId: string, file: Express.Multer.File, filename: string) {
    if (!file) {
      throw new BadRequestException('未上传文件');
    }
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(`不支持的文件类型：${file.mimetype}`);
    }

    const dir = path.join('uploads', userId);
    fs.mkdirSync(dir, { recursive: true });

    const originalName = filename;
    const savedName = `${Date.now()}-${originalName}`;
    const filePath = path.join(dir, savedName);
    fs.writeFileSync(filePath, file.buffer);

    return this.prisma.document.create({
      data: {
        userId,
        filename: originalName,
        mimeType: file.mimetype,
        size: file.size,
        storageType: 'local',
        filePath,
      },
    });
  }

  async findByUser(userId: string) {
    return this.prisma.document.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { chunks: true } } },
    });
  }

  async findById(documentId: string, userId: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: { chunks: { orderBy: { chunkIndex: 'asc' } } },
    });
    if (!doc) throw new NotFoundException('文档不存在');
    if (doc.userId !== userId) throw new ForbiddenException('无权访问该文档');
    return doc;
  }

  async delete(documentId: string, userId: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
    });
    if (!doc) throw new NotFoundException('文档不存在');
    if (doc.userId !== userId) throw new ForbiddenException('无权访问该文档');

    if (doc.filePath) {
      try {
        fs.unlinkSync(doc.filePath);
      } catch {
        // file already gone — ignore
      }
    }
    await this.prisma.document.delete({ where: { id: documentId } });
  }
}
