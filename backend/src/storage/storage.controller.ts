import {
  BadRequestException,
  Body,
  Controller,
  Get,
  ParseFilePipeBuilder,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { diskStorage } from 'multer';
import { randomBytes } from 'crypto';
import { mkdirSync } from 'fs';
import { extname, join } from 'path';
import { StorageService, localUploadRoot } from './storage.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

const imageValidator = new ParseFilePipeBuilder()
  .addFileTypeValidator({ fileType: /^image\/(jpeg|png|webp|avif)$/ })
  .addMaxSizeValidator({ maxSize: 8 * 1024 * 1024 }) // 8 MB
  .build({ fileIsRequired: true });

class PresignDto {
  @IsString()
  @Matches(/^(videos|trailers|subtitles|posters|banners|thumbnails)$/)
  folder!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  filename!: string;

  @IsString()
  @Matches(/^(video|image|text|application)\//)
  contentType!: string;
}

/**
 * Local-mode video uploads stream straight to disk (never into memory),
 * landing in the frontend's public/uploads folder.
 */
const localVideoStorage = diskStorage({
  destination: (req, _file, cb) => {
    const folder =
      (req.query.folder as string) === 'trailers' ? 'trailers' : 'videos';
    const dir = join(localUploadRoot(), folder);
    mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = extname(file.originalname) || '';
    cb(null, `${Date.now()}-${randomBytes(8).toString('hex')}${ext}`);
  },
});

@Controller('storage')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  /** Tells the admin UI whether to use presigned R2 or local uploads. */
  @Get('mode')
  mode() {
    return this.storage.mode();
  }

  @Post('poster')
  @UseInterceptors(FileInterceptor('file'))
  uploadPoster(@UploadedFile(imageValidator) file: Express.Multer.File) {
    return this.storage.upload(file, 'posters');
  }

  @Post('banner')
  @UseInterceptors(FileInterceptor('file'))
  uploadBanner(@UploadedFile(imageValidator) file: Express.Multer.File) {
    return this.storage.upload(file, 'banners');
  }

  @Post('thumbnail')
  @UseInterceptors(FileInterceptor('file'))
  uploadThumbnail(@UploadedFile(imageValidator) file: Express.Multer.File) {
    return this.storage.upload(file, 'thumbnails');
  }

  /**
   * Large files (movies, trailers) never pass through the API in R2 mode:
   * the admin UI asks for a presigned URL and PUTs the file straight to R2.
   */
  @Post('presign')
  presign(@Body() dto: PresignDto) {
    return this.storage.presign(dto.folder, dto.filename, dto.contentType);
  }

  /** Local-mode video/trailer upload (?folder=videos|trailers). */
  @Post('video')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: localVideoStorage,
      limits: { fileSize: 4 * 1024 * 1024 * 1024 }, // 4 GB
    }),
  )
  uploadVideo(
    @UploadedFile() file: Express.Multer.File,
    @Query('folder') folder?: string,
  ) {
    if (!file) {
      throw new BadRequestException('Файл ирсэнгүй');
    }
    if (!file.mimetype.startsWith('video/')) {
      throw new BadRequestException('Зөвхөн видео файл зөвшөөрөгдөнө');
    }
    return this.storage.registerLocalFile(
      file,
      folder === 'trailers' ? 'trailers' : 'videos',
    );
  }
}
