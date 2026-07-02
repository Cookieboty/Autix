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
  }) {
    const config = await this.getRuntimeConfig();
    const ext = opts.fileName.split('.').pop() ?? 'bin';
    const prefix = opts.folder ? `${opts.folder}/` : '';
    const key = `${prefix}${Date.now()}-${randomBytes(8).toString('hex')}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      ContentType: opts.contentType,
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
    const extension = opts.ext ?? 'png';
    const prefix = opts.folder ? `${opts.folder}/` : '';
    const key = `${prefix}${Date.now()}-${randomBytes(8).toString('hex')}.${extension}`;

    await config.client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: buffer,
        ContentType: opts.contentType,
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
