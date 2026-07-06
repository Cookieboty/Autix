import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { ALLOWED_MIME_TYPES } from './document.constants';
import { DocumentRepository } from './document.repository';

// 仅保留基础名并去掉路径分隔符，用作对外展示名；绝不用于拼接落盘路径。
function sanitizeDisplayName(raw: string): string {
  // 归一化反斜杠（POSIX path.basename 不按 \ 切分）→ 取 basename → 去残留分隔符与开头的点，
  // 保留内部的点以便保留扩展名。
  const separators = /[/\\]/g;
  const leadingDots = /^\.+/;
  const base = path
    .basename(raw.replace(/\\/g, '/'))
    .replace(separators, '')
    .replace(leadingDots, '')
    .trim();
  return base.length > 0 ? base.slice(0, 255) : 'file';
}

// 从展示名安全提取扩展名（白名单字符），用于随机落盘名，避免把用户输入拼进路径。
function safeExtension(displayName: string): string {
  const ext = path.extname(displayName).toLowerCase();
  return /^\.[a-z0-9]{1,12}$/.test(ext) ? ext : '';
}

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

    const dir = path.resolve('uploads', userId);
    fs.mkdirSync(dir, { recursive: true });

    // 展示名保留原始文件名（已消毒），落盘名使用随机 ID，杜绝用户输入进入路径。
    const displayName = sanitizeDisplayName(filename);
    const savedName = `${Date.now()}-${randomUUID()}${safeExtension(displayName)}`;
    const filePath = path.join(dir, savedName);

    // 纵深防御：解析后的落盘路径必须严格位于用户目录内。
    if (path.resolve(filePath) !== filePath || !filePath.startsWith(dir + path.sep)) {
      throw new BadRequestException('非法的文件路径');
    }
    fs.writeFileSync(filePath, file.buffer);

    return this.documentRepository.create({
      userId,
      filename: displayName,
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
