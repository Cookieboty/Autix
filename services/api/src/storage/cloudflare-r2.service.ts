import { Injectable } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomBytes } from 'crypto';

@Injectable()
export class CloudflareR2Service {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor() {
    this.bucket = process.env.R2_BUCKET_NAME ?? '';
    this.publicUrl = (process.env.DOMAIN ?? '').replace(/\/$/, '');

    this.client = new S3Client({
      region: 'auto',
      endpoint: process.env.S3_API ?? '',
      credentials: {
        accessKeyId: process.env.Access_key_ID ?? '',
        secretAccessKey: process.env.Secret_Access_Key ?? '',
      },
    });
  }

  /**
   * Generate a presigned PUT URL for direct browser upload.
   * Returns { uploadUrl, publicUrl, key }.
   */
  async createPresignedUpload(opts: {
    fileName: string;
    contentType: string;
    folder?: string;
  }) {
    const ext = opts.fileName.split('.').pop() ?? 'bin';
    const prefix = opts.folder ? `${opts.folder}/` : '';
    const key = `${prefix}${Date.now()}-${randomBytes(8).toString('hex')}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: opts.contentType,
    });

    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn: 600,
    });

    return {
      uploadUrl,
      publicUrl: `${this.publicUrl}/${key}`,
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
    const extension = opts.ext ?? 'png';
    const prefix = opts.folder ? `${opts.folder}/` : '';
    const key = `${prefix}${Date.now()}-${randomBytes(8).toString('hex')}.${extension}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: opts.contentType,
      }),
    );

    return {
      publicUrl: `${this.publicUrl}/${key}`,
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
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}
