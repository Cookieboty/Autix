import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { ALLOWED_MIME_TYPES } from './document.constants';
import { DocumentRepository } from './document.repository';

@Injectable()
export class DocumentService {
  constructor(private readonly documentRepository: DocumentRepository) {}

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

    return this.documentRepository.create({
      userId,
      filename: originalName,
      mimeType: file.mimetype,
      size: file.size,
      storageType: 'local',
      filePath,
    });
  }

  async findByUser(userId: string) {
    return this.documentRepository.findByUser(userId);
  }

  async findById(documentId: string, userId: string) {
    const doc = await this.documentRepository.findByIdWithChunks(documentId);
    if (!doc) throw new NotFoundException('文档不存在');
    if (doc.userId !== userId) throw new ForbiddenException('无权访问该文档');
    return doc;
  }

  async delete(documentId: string, userId: string) {
    const doc = await this.documentRepository.findById(documentId);
    if (!doc) throw new NotFoundException('文档不存在');
    if (doc.userId !== userId) throw new ForbiddenException('无权访问该文档');

    if (doc.filePath) {
      try {
        fs.unlinkSync(doc.filePath);
      } catch {
        // file already gone — ignore
      }
    }
    await this.documentRepository.delete(documentId);
  }
}
