import { BadRequestException, Injectable } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomBytes } from 'crypto';
import { SystemSettingsService } from '../system-settings/system-settings.service';

type R2RuntimeConfig = {
  client: S3Client;
  bucket: string;
  publicUrl: string;
};

// 允许直传的安全内容类型白名单：仅媒体与 PDF，杜绝 html/svg/xml/js 等可在 CDN 源被浏览器
// 当作活动内容执行的类型（存储型 XSS）。新增合法类型时在此登记。
const SAFE_UPLOAD_CONTENT_TYPES = new Set([
  'image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'image/avif', 'image/bmp', 'image/tiff',
  'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska',
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/aac',
  'application/pdf',
  // 聊天附件支持的文档类型：均非浏览器可执行的活动内容，安全（仍禁止 html/svg/xml/js）。
  'text/plain', 'text/markdown', 'text/x-markdown',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

// 归一化内容类型（去除 charset 等参数并转小写）。
function normalizeContentType(contentType: string): string {
  return contentType.split(';')[0]?.trim().toLowerCase() ?? '';
}

// 清洗 folder：去掉盘符/绝对路径/`..`/非法字符，防止写入他人或系统命名空间。
function sanitizeFolder(folder?: string): string {
  if (!folder) return '';
  return folder
    .replace(/\\/g, '/')
    .split('/')
    .filter((seg) => seg && seg !== '.' && seg !== '..')
    .map((seg) => seg.replace(/[^a-zA-Z0-9._-]/g, ''))
    .filter(Boolean)
    .join('/');
}

@Injectable()
export class CloudflareR2Service {
  constructor(private readonly systemSettingsService: SystemSettingsService) {}

  /**
   * Generate a presigned PUT URL for direct browser upload.
   * Returns { uploadUrl, publicUrl, key }.
   */
  async createPresignedUpload(opts: {
    fileName: string;
    contentType: string;
    folder?: string;
    /**
     * 认证用户 id。注意：不再把它拼进对象 key —— 加 `u/${userId}/` 前缀会改变对象路径，
     * 若 R2 公有访问/CORS 是按前缀配置的，会导致上传后按 URL 回源失败（画板贴图回归）。
     * 真正的按用户隔离应通过鉴权的签名 GET 代理实现，而非依赖 key 前缀（对象本身仍是公有可读）。
     */
    userId?: string;
  }) {
    const config = await this.getRuntimeConfig();

    const contentType = normalizeContentType(opts.contentType);
    if (!SAFE_UPLOAD_CONTENT_TYPES.has(contentType)) {
      throw new BadRequestException(`不支持的上传内容类型：${opts.contentType}`);
    }

    // 扩展名限定为安全字符集，避免用户输入拼进 key。
    const rawExt = opts.fileName.split('.').pop()?.toLowerCase() ?? '';
    const ext = /^[a-z0-9]{1,12}$/.test(rawExt) ? rawExt : 'bin';
    const folder = sanitizeFolder(opts.folder);
    const folderPrefix = folder ? `${folder}/` : '';
    const key = `${folderPrefix}${Date.now()}-${randomBytes(8).toString('hex')}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(config.client, command, {
      expiresIn: 600,
    });

    return {
      uploadUrl,
      publicUrl: `${config.publicUrl}/${key}`,
      key,
    };
  }

  /**
   * Server-side upload of a Buffer (e.g. base64-decoded image from model API).
   */
  async uploadBuffer(buffer: Buffer, opts: {
    contentType: string;
    folder?: string;
    ext?: string;
  }) {
    const config = await this.getRuntimeConfig();
    const rawExt = (opts.ext ?? 'png').toLowerCase();
    const extension = /^[a-z0-9]{1,12}$/.test(rawExt) ? rawExt : 'bin';
    const folder = sanitizeFolder(opts.folder);
    const prefix = folder ? `${folder}/` : '';
    const key = `${prefix}${Date.now()}-${randomBytes(8).toString('hex')}.${extension}`;

    // 服务端回源内容类型不可信（如管理端导入的任意来源）：非白名单一律降级为不可执行类型。
    const normalized = normalizeContentType(opts.contentType);
    const contentType = SAFE_UPLOAD_CONTENT_TYPES.has(normalized)
      ? normalized
      : 'application/octet-stream';

    await config.client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );

    return {
      publicUrl: `${config.publicUrl}/${key}`,
      key,
    };
  }

  async uploadBase64Image(base64: string, folder: string) {
    const match = base64.match(/^data:image\/([\w+.-]+);base64,(.+)$/);
    if (!match) throw new Error('Invalid base64 image');

    const [, ext, payload] = match;
    const buffer = Buffer.from(payload, 'base64');
    return this.uploadBuffer(buffer, {
      contentType: `image/${ext}`,
      folder,
      ext: ext.replace(/^jpeg$/, 'jpg'),
    });
  }

  async deleteObject(key: string) {
    const config = await this.getRuntimeConfig();
    await config.client.send(
      new DeleteObjectCommand({ Bucket: config.bucket, Key: key }),
    );
  }

  /** Resolve a stored object key into its accessible public URL. */
  async getPublicUrl(key: string): Promise<string> {
    const publicUrl = (await this.setting('storage.r2PublicUrl')).replace(/\/+$/, '');
    return `${publicUrl}/${key.replace(/^\/+/, '')}`;
  }

  private async getRuntimeConfig(): Promise<R2RuntimeConfig> {
    const bucket = await this.setting('storage.r2BucketName');
    const publicUrl = (await this.setting('storage.r2PublicUrl')).replace(/\/+$/, '');
    const endpoint = await this.setting('storage.r2Endpoint');
    const accessKeyId = await this.setting('storage.r2AccessKeyId');
    const secretAccessKey = await this.setting('storage.r2SecretAccessKey');

    const missing = [
      ['R2_BUCKET_NAME', bucket],
      ['DOMAIN', publicUrl],
      ['S3_API', endpoint],
      ['Access_key_ID', accessKeyId],
      ['Secret_Access_Key', secretAccessKey],
    ]
      .filter(([, value]) => !value)
      .map(([key]) => key);

    if (missing.length > 0) {
      throw new BadRequestException(`Cloudflare R2 配置不完整: ${missing.join(', ')}`);
    }

    return {
      bucket,
      publicUrl,
      client: new S3Client({
        region: 'auto',
        endpoint,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      }),
    };
  }

  private async setting(key: string) {
    return this.systemSettingsService.getString(key).catch(() => '');
  }
}
