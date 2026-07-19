import { BadRequestException, Injectable } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
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

/**
 * 显式文件名的白名单过滤：只留 [A-Za-z0-9._-]，去掉目录分隔与 `.`/`..`。
 * 过滤后为空则返回 '' —— 调用方据此回退到随机名，而不是拼出个裸扩展名的 key。
 */
function sanitizeFileName(fileName?: string): string {
  if (!fileName) return '';
  const cleaned = fileName.replace(/[^a-zA-Z0-9._-]/g, '');
  if (!cleaned || cleaned === '.' || cleaned === '..') return '';
  return cleaned.slice(0, 120);
}

@Injectable()
export class CloudflareR2Service {
  constructor(private readonly systemSettingsService: SystemSettingsService) { }

  /**
   * Generate a presigned PUT URL for direct browser upload.
   * Returns { uploadUrl, publicUrl, key }.
   */
  async createPresignedUpload(opts: {
    fileName: string;
    contentType: string;
    folder?: string;
    /** 传入时把精确 Content-Length 绑定到 presigned PUT 签名。 */
    sizeBytes?: number;
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
      ContentLength: opts.sizeBytes,
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
    /**
     * 文件名（不含目录与扩展名）。给了就用它，否则按 `时间戳-随机` 生成。
     *
     * 存在的意义是**幂等**：同一份逻辑产物重复上传时落到同一个 key，覆盖写而不是
     * 各自留一份。视频生成的回调与轮询会并发收敛同一条 generation，随机 key 会让
     * 两边各产出一个对象——generation 指向后写的那个、素材库指向先写的那个，
     * 内容一样却对不上，还多一个没人回收的孤儿。
     *
     * 与 folder 同样过 sanitize：调用方传的是内部 id，但这里是拼 object key 的地方，
     * 不做校验就等于把路径穿越的口子开在存储层。
     */
    fileName?: string;
  }) {
    const config = await this.getRuntimeConfig();
    const rawExt = (opts.ext ?? 'png').toLowerCase();
    const extension = /^[a-z0-9]{1,12}$/.test(rawExt) ? rawExt : 'bin';
    const folder = sanitizeFolder(opts.folder);
    const prefix = folder ? `${folder}/` : '';
    const fileName = sanitizeFileName(opts.fileName);
    const key = fileName
      ? `${prefix}${fileName}.${extension}`
      : `${prefix}${Date.now()}-${randomBytes(8).toString('hex')}.${extension}`;

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

  /**
   * T10: HeadObject 存在性检查（不下载对象体）。
   * 返回 true=对象存在；false=对象不存在（404）。
   * 抛出=网络或权限错误（由调用方决定重试）。
   * cleanup worker 用此在 DeleteObject 前先探测，把"对象已经不在"这种情况直接标记为 COMPLETED。
   */
  async objectExists(key: string): Promise<boolean> {
    return (await this.getObjectMetadata(key)).exists;
  }

  async getObjectMetadata(key: string): Promise<{
    exists: boolean;
    contentLength: number | null;
    contentType: string | null;
  }> {
    const config = await this.getRuntimeConfig();
    try {
      const result = await config.client.send(
        new HeadObjectCommand({ Bucket: config.bucket, Key: key }),
      );
      return {
        exists: true,
        contentLength: result.ContentLength ?? null,
        contentType: result.ContentType ?? null,
      };
    } catch (err) {
      const status = (err as { $metadata?: { httpStatusCode?: number }; name?: string })?.$metadata?.httpStatusCode;
      const name = (err as { name?: string })?.name;
      if (status === 404 || name === 'NotFound' || name === 'NoSuchKey') {
        return { exists: false, contentLength: null, contentType: null };
      }
      throw err;
    }
  }

  /** Resolve a stored object key into its accessible public URL. */
  async getPublicUrl(key: string): Promise<string> {
    const publicUrl = (await this.setting('storage.r2PublicUrl')).replace(/\/+$/, '');
    return `${publicUrl}/${key.replace(/^\/+/, '')}`;
  }

  /**
   * T18: 服务端拉取对象体到内存 Buffer，供 sharp 等预处理管线使用。
   * 用途：头像 consume 阶段下载用户 PUT 的原图，做 resize/strip metadata 后再重新上传。
   * 注意：调用方必须自行约束大小（AVATAR_UPLOAD_LIMITS.maxSizeBytes），
   * 避免恶意大对象引发 OOM。当前实现直接读到内存；如未来引入 >10MB 场景应改成流式。
   */
  async downloadObject(key: string): Promise<Buffer> {
    const config = await this.getRuntimeConfig();
    const res = await config.client.send(
      new GetObjectCommand({ Bucket: config.bucket, Key: key }),
    );
    const body = res.Body as unknown as { transformToByteArray?: () => Promise<Uint8Array> } | undefined;
    if (!body || typeof body.transformToByteArray !== 'function') {
      throw new Error(`R2 downloadObject: empty body for key=${key}`);
    }
    const bytes = await body.transformToByteArray();
    return Buffer.from(bytes);
  }

  /** R2 公网访问域名前缀（无尾斜杠）。空串表示未配置。供"非我域名"过滤判断媒体是否已托管在自有 R2。 */
  async getPublicBaseUrl(): Promise<string> {
    return (await this.setting('storage.r2PublicUrl')).replace(/\/+$/, '');
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
