import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { ContentService } from './content.service';
import { CreateContentDto } from './dto/create-content.dto';
import { UpdateContentDto } from './dto/update-content.dto';
import { QueryContentDto } from './dto/query-content.dto';
import { CreateEpisodeDto, CreateSeasonDto } from './dto/season-episode.dto';
import { CreateSubtitleDto, CreateVideoAssetDto } from './dto/video-asset.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SubscriptionGuard } from '../billing/guards/subscription.guard';

@Controller('content')
export class ContentController {
  constructor(private readonly content: ContentService) {}

  // ---------------------------------------------------------------- public

  @Get()
  list(@Query() query: QueryContentDto) {
    return this.content.list(query, false);
  }

  // Static segments are declared before ':idOrSlug'.
  @Get('genres')
  genres() {
    return this.content.listGenres();
  }

  // Admin: everything, including drafts.
  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  listAdmin(@Query() query: QueryContentDto) {
    return this.content.list(query, true);
  }

  @Get('admin/:idOrSlug')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  getAdmin(@Param('idOrSlug') idOrSlug: string) {
    return this.content.get(idOrSlug, true);
  }

  // Streaming sources — needs a live subscription (admins bypass).
  @Get(':id/watch')
  @UseGuards(JwtAuthGuard, SubscriptionGuard)
  watch(@Param('id') id: string, @Query('episodeId') episodeId?: string) {
    return this.content.watch(id, episodeId || undefined);
  }

  @Get(':idOrSlug')
  get(@Param('idOrSlug') idOrSlug: string) {
    return this.content.get(idOrSlug, false);
  }

  // ----------------------------------------------------------------- admin

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateContentDto) {
    return this.content.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateContentDto) {
    return this.content.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.content.remove(id);
  }

  // Seasons / episodes

  @Post(':id/seasons')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  addSeason(@Param('id') id: string, @Body() dto: CreateSeasonDto) {
    return this.content.addSeason(id, dto);
  }

  @Delete('seasons/:seasonId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  removeSeason(@Param('seasonId') seasonId: string) {
    return this.content.removeSeason(seasonId);
  }

  @Post('seasons/:seasonId/episodes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  addEpisode(@Param('seasonId') seasonId: string, @Body() dto: CreateEpisodeDto) {
    return this.content.addEpisode(seasonId, dto);
  }

  @Patch('episodes/:episodeId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  updateEpisode(
    @Param('episodeId') episodeId: string,
    @Body() dto: CreateEpisodeDto,
  ) {
    return this.content.updateEpisode(episodeId, dto);
  }

  @Delete('episodes/:episodeId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  removeEpisode(@Param('episodeId') episodeId: string) {
    return this.content.removeEpisode(episodeId);
  }

  // Video assets / subtitles

  @Post(':id/video-assets')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  addVideoAsset(@Param('id') id: string, @Body() dto: CreateVideoAssetDto) {
    return this.content.addVideoAsset(id, dto);
  }

  @Delete('video-assets/:assetId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  removeVideoAsset(@Param('assetId') assetId: string) {
    return this.content.removeVideoAsset(assetId);
  }

  @Post(':id/subtitles')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  addSubtitle(@Param('id') id: string, @Body() dto: CreateSubtitleDto) {
    return this.content.addSubtitle(id, dto);
  }

  @Delete('subtitles/:subtitleId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  removeSubtitle(@Param('subtitleId') subtitleId: string) {
    return this.content.removeSubtitle(subtitleId);
  }
}
