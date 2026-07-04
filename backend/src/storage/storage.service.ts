import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomBytes } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { extname, join, resolve } from 'path';

export interface UploadResult {
  key: string;
  url: string;
}

export interface PresignResult extends UploadResult {
  /** Browser PUTs the file straight to R2 with this URL. */
  uploadUrl: string;
  expiresIn: number;
}

/** Folders the API will hand out upload URLs for. */
const PRESIGN_FOLDERS = new Set([
  'videos',
  'trailers',
  'subtitles',
  'posters',
  'banners',
  'thumbnails',
]);

const PRESIGN_EXPIRES_SECONDS = 3600;

/** Where local-mode uploads land: served by Next.js at /uploads/... */
export function localUploadRoot(): string {
  return (
    process.env.LOCAL_UPLOAD_DIR ??
    resolve(process.cwd(), '..', 'frontend', 'public', 'uploads')
  );
}

/**
 * File storage with two modes:
 *
 * - **R2** (production): set the R2_* env vars — images upload through the
 *   API, large videos go straight to R2 via presigned PUT URLs.
 * - **Local** (dev, R2 not configured): files are written into the
 *   frontend's public/uploads folder so they serve immediately at /uploads/…
 *   No code changes needed to switch — just fill in the env vars.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private client?: S3Client;

  constructor(private readonly config: ConfigService) {}

  get r2Configured(): boolean {
    return Boolean(
      this.config.get('R2_ACCOUNT_ID') &&
        this.config.get('R2_ACCESS_KEY_ID') &&
        this.config.get('R2_SECRET_ACCESS_KEY') &&
        this.config.get('R2_BUCKET_NAME'),
    );
  }

  /** Which upload flow the admin UI should use. */
  mode(): { mode: 'r2' | 'local' } {
    return { mode: this.r2Configured ? 'r2' : 'local' };
  }

  private get bucket(): string {
    return this.config.get<string>('R2_BUCKET_NAME', '');
  }

  private get publicUrl(): string {
    return this.config.get<string>('R2_PUBLIC_URL', '').replace(/\/$/, '');
  }

  private getClient(): S3Client {
    if (this.client) {
      return this.client;
    }
    const accountId = this.config.get<string>('R2_ACCOUNT_ID', '');
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: this.config.get<string>('R2_ACCESS_KEY_ID', ''),
        secretAccessKey: this.config.get<string>('R2_SECRET_ACCESS_KEY', ''),
      },
    });
    return this.client;
  }

  private buildFilename(originalName: string): string {
    const ext = extname(originalName) || '';
    return `${Date.now()}-${randomBytes(8).toString('hex')}${ext}`;
  }

  /** Upload a small file buffer (images) — R2 when configured, else disk. */
  async upload(file: Express.Multer.File, folder: string): Promise<UploadResult> {
    const filename = this.buildFilename(file.originalname);
    const key = `${folder}/${filename}`;

    if (!this.r2Configured) {
      return this.saveLocal(folder, filename, file.buffer);
    }

    try {
      await this.getClient().send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        }),
      );
    } catch (err) {
      this.logger.error('R2 upload failed', err as Error);
      throw new InternalServerErrorException('File upload failed');
    }

    const url = this.publicUrl ? `${this.publicUrl}/${key}` : key;
    return { key, url };
  }

  private async saveLocal(
    folder: string,
    filename: string,
    buffer: Buffer,
  ): Promise<UploadResult> {
    const dir = join(localUploadRoot(), folder);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, filename), buffer);
    this.logger.log(`Saved local upload: ${folder}/${filename}`);
    return { key: `${folder}/${filename}`, url: `/uploads/${folder}/${filename}` };
  }

  /** A local-mode video already written to disk by multer's disk storage. */
  registerLocalFile(file: Express.Multer.File, folder: string): UploadResult {
    return {
      key: `${folder}/${file.filename}`,
      url: `/uploads/${folder}/${file.filename}`,
    };
  }

  /** Direct-to-R2 upload URL for large files. R2 mode only. */
  async presign(
    folder: string,
    filename: string,
    contentType: string,
  ): Promise<PresignResult> {
    if (!PRESIGN_FOLDERS.has(folder)) {
      throw new BadRequestException('Invalid upload folder');
    }
    if (!this.r2Configured) {
      throw new BadRequestException(
        'R2 тохируулаагүй байна — локал горимд /storage/video ашиглана.',
      );
    }

    const key = `${folder}/${this.buildFilename(filename)}`;
    const uploadUrl = await getSignedUrl(
      this.getClient(),
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
      }),
      { expiresIn: PRESIGN_EXPIRES_SECONDS },
    );

    const url = this.publicUrl ? `${this.publicUrl}/${key}` : key;
    return { key, url, uploadUrl, expiresIn: PRESIGN_EXPIRES_SECONDS };
  }
}
