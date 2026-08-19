import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomBytes } from 'crypto';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { join, normalize, resolve, sep } from 'path';

/** Stored file extension is derived from the (validated) MIME type, never the
 *  client filename — a spoofed "evil.html" can't be served as HTML. */
const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/avif': '.avif',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
  'video/x-matroska': '.mkv',
  'text/vtt': '.vtt',
  'application/x-subrip': '.srt',
};

export function extForMime(mimeType: string): string {
  return EXT_BY_MIME[mimeType] ?? '.bin';
}

/** True when the buffer's leading bytes match the claimed image MIME type —
 *  defeats a text/HTML payload uploaded with a spoofed image Content-Type. */
export function isValidImageSignature(buf: Buffer, mimeType: string): boolean {
  if (buf.length < 12) return false;
  switch (mimeType) {
    case 'image/jpeg':
      return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    case 'image/png':
      return (
        buf[0] === 0x89 &&
        buf[1] === 0x50 &&
        buf[2] === 0x4e &&
        buf[3] === 0x47
      );
    case 'image/webp':
      return (
        buf.toString('ascii', 0, 4) === 'RIFF' &&
        buf.toString('ascii', 8, 12) === 'WEBP'
      );
    case 'image/avif':
      // ISO-BMFF: "ftyp" box at offset 4, an AVIF-family brand at offset 8.
      return (
        buf.toString('ascii', 4, 8) === 'ftyp' &&
        ['avif', 'avis', 'mif1', 'mif1'].includes(buf.toString('ascii', 8, 12))
      );
    default:
      return false;
  }
}

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

/** Folders whose objects must stay private — streamed via signed URLs only,
 *  never through a public bucket domain. Everything else (images) is public. */
const PRIVATE_FOLDERS = new Set(['videos', 'subtitles', 'trailers']);

const PRESIGN_EXPIRES_SECONDS = 3600;

/** Playback links live long enough for one sitting, then expire. */
const PLAYBACK_URL_EXPIRES_SECONDS = 6 * 3600;

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

  /** Private bucket for streamed media. Falls back to the main bucket when
   *  unset, so single-bucket setups keep working unchanged. */
  private get videoBucket(): string {
    return this.config.get<string>('R2_VIDEO_BUCKET_NAME', '') || this.bucket;
  }

  private bucketForFolder(folder: string): string {
    return PRIVATE_FOLDERS.has(folder) ? this.videoBucket : this.bucket;
  }

  private bucketForKey(key: string): string {
    return this.bucketForFolder(key.split('/')[0] ?? '');
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

  private buildFilename(mimeType: string): string {
    return `${Date.now()}-${randomBytes(8).toString('hex')}${extForMime(mimeType)}`;
  }

  /** Upload a small file buffer (images) — R2 when configured, else disk. */
  async upload(file: Express.Multer.File, folder: string): Promise<UploadResult> {
    // Content sniffing: the ParseFilePipe only checks the client-set MIME; here
    // we confirm the bytes really are that image, blocking HTML/SVG smuggled in
    // under an image Content-Type (stored XSS on the public /uploads origin).
    if (!isValidImageSignature(file.buffer, file.mimetype)) {
      throw new BadRequestException('Зургийн файл танигдсангүй');
    }
    const filename = this.buildFilename(file.mimetype);
    const key = `${folder}/${filename}`;

    if (!this.r2Configured) {
      return this.saveLocal(folder, filename, file.buffer);
    }

    try {
      await this.getClient().send(
        new PutObjectCommand({
          Bucket: this.bucketForFolder(folder),
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        }),
      );
    } catch (err) {
      this.logger.error('R2 upload failed', err as Error);
      throw new InternalServerErrorException('File upload failed');
    }

    // Private folders never get a public URL — they stream via signed links.
    const url =
      !PRIVATE_FOLDERS.has(folder) && this.publicUrl
        ? `${this.publicUrl}/${key}`
        : key;
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

  /**
   * Short-lived signed GET URL for playback. Keeps R2 objects private —
   * entitled viewers stream via expiring links instead of permanent URLs.
   */
  async presignGetUrl(
    key: string,
    expiresIn = PLAYBACK_URL_EXPIRES_SECONDS,
  ): Promise<string> {
    return getSignedUrl(
      this.getClient(),
      new GetObjectCommand({ Bucket: this.bucketForKey(key), Key: key }),
      { expiresIn },
    );
  }

  /**
   * Recover a storage key from a stored URL: `${R2_PUBLIC_URL}/<key>` (public
   * images) or `/uploads/<key>` (local mode). External URLs (YouTube trailers
   * etc.) return null and are never touched.
   */
  keyFromUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    if (this.publicUrl && url.startsWith(`${this.publicUrl}/`)) {
      return url.slice(this.publicUrl.length + 1);
    }
    if (url.startsWith('/uploads/')) {
      return url.slice('/uploads/'.length);
    }
    return null;
  }

  /**
   * Best-effort delete of stored objects (R2) or local files. Never throws —
   * a failed cleanup must not fail the request that triggered it.
   */
  async deleteObjects(keys: Array<string | null | undefined>): Promise<void> {
    const unique = [...new Set(keys.filter((k): k is string => Boolean(k)))];
    await Promise.allSettled(unique.map((key) => this.deleteObject(key)));
  }

  private async deleteObject(key: string): Promise<void> {
    try {
      if (this.r2Configured) {
        await this.getClient().send(
          new DeleteObjectCommand({ Bucket: this.bucketForKey(key), Key: key }),
        );
        this.logger.log(`Deleted R2 object: ${key}`);
        return;
      }
      // Local mode: the key is a path under the uploads root. Reject anything
      // that would escape it (absolute paths, `..` traversal).
      const root = resolve(localUploadRoot());
      const target = resolve(root, normalize(key));
      if (target !== root && !target.startsWith(root + sep)) {
        this.logger.warn(`Refusing to delete outside uploads root: ${key}`);
        return;
      }
      await unlink(target);
      this.logger.log(`Deleted local upload: ${key}`);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code !== 'ENOENT') {
        this.logger.warn(`Failed to delete stored object ${key}: ${String(err)}`);
      }
    }
  }

  /** Direct-to-R2 upload URL for large files. R2 mode only. The stored key's
   *  extension comes from contentType, so the client filename is not used. */
  async presign(folder: string, contentType: string): Promise<PresignResult> {
    if (!PRESIGN_FOLDERS.has(folder)) {
      throw new BadRequestException('Invalid upload folder');
    }
    if (!this.r2Configured) {
      throw new BadRequestException(
        'R2 тохируулаагүй байна — локал горимд /storage/video ашиглана.',
      );
    }

    const key = `${folder}/${this.buildFilename(contentType)}`;
    const uploadUrl = await getSignedUrl(
      this.getClient(),
      new PutObjectCommand({
        Bucket: this.bucketForFolder(folder),
        Key: key,
        ContentType: contentType,
      }),
      { expiresIn: PRESIGN_EXPIRES_SECONDS },
    );

    const url =
      !PRIVATE_FOLDERS.has(folder) && this.publicUrl
        ? `${this.publicUrl}/${key}`
        : key;
    return { key, url, uploadUrl, expiresIn: PRESIGN_EXPIRES_SECONDS };
  }
}
