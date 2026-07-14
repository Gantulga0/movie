import {
  Body,
  Controller,
  ParseFilePipeBuilder,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService, SafeUser } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { StorageService } from '../storage/storage.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

/** Avatars stay small; only common web image types are accepted. */
const avatarValidator = new ParseFilePipeBuilder()
  .addFileTypeValidator({ fileType: /^image\/(jpeg|png|webp|avif)$/ })
  .addMaxSizeValidator({ maxSize: 4 * 1024 * 1024 }) // 4 MB
  .build({ fileIsRequired: true });

/**
 * Self-service profile endpoints. Every route only ever touches the
 * authenticated caller's own account — no ids are accepted from the client.
 */
@Controller('me')
@UseGuards(JwtAuthGuard)
export class MeController {
  constructor(
    private readonly users: UsersService,
    private readonly storage: StorageService,
  ) {}

  @Patch('profile')
  updateProfile(@CurrentUser() user: SafeUser, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(user.id, dto);
  }

  /** Uploads a new profile image and points the account at it. */
  @Post('avatar')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(
    @CurrentUser() user: SafeUser,
    @UploadedFile(avatarValidator) file: Express.Multer.File,
  ) {
    const { url } = await this.storage.upload(file, 'avatars');
    return this.users.updateProfile(user.id, { avatarUrl: url });
  }
}
