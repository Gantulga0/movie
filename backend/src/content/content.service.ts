import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ContentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { slugify, slugWithSuffix } from '../common/ids';
import { CreateContentDto } from './dto/create-content.dto';
import { UpdateContentDto } from './dto/update-content.dto';
import { QueryContentDto } from './dto/query-content.dto';
import { CreateEpisodeDto, CreateSeasonDto } from './dto/season-episode.dto';
import { CreateSubtitleDto, CreateVideoAssetDto } from './dto/video-asset.dto';

const DEFAULT_PAGE_SIZE = 24;

/** Card-level include used by list views. */
const listInclude = {
  genres: { include: { genre: true } },
} satisfies Prisma.ContentInclude;

@Injectable()
export class ContentService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------- public

  async list(query: QueryContentDto, adminView = false) {
    const where: Prisma.ContentWhereInput = {};

    // Public callers only ever see published content.
    if (!adminView) {
      where.status = ContentStatus.PUBLISHED;
    } else if (query.status) {
      where.status = query.status;
    }

    if (query.type) where.type = query.type;
    if (query.featured !== undefined) where.featured = query.featured;
    if (query.genre) {
      where.genres = { some: { genre: { slug: query.genre } } };
    }
    if (query.search) {
      where.title = { contains: query.search, mode: 'insensitive' };
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.content.findMany({
        where,
        include: listInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.content.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  /** Detail view. Video asset URLs are withheld — those come from `watch`. */
  async get(idOrSlug: string, adminView = false) {
    const content = await this.prisma.content.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
        ...(adminView ? {} : { status: ContentStatus.PUBLISHED }),
      },
      include: {
        genres: { include: { genre: true } },
        seasons: {
          orderBy: { number: 'asc' },
          include: {
            episodes: {
              orderBy: { number: 'asc' },
              include: {
                videoAssets: { select: { id: true, quality: true } },
              },
            },
          },
        },
        // Which qualities exist is public; the URLs are not.
        videoAssets: { select: { id: true, quality: true } },
        subtitles: { select: { id: true, language: true, label: true } },
      },
    });
    if (!content) {
      throw new NotFoundException('Контент олдсонгүй');
    }

    const rating = await this.prisma.rating.aggregate({
      where: { contentId: content.id },
      _avg: { score: true },
      _count: true,
    });

    return {
      ...content,
      ratingAvg: rating._avg.score,
      ratingCount: rating._count,
    };
  }

  /** Playable stream sources. Callers must pass the SubscriptionGuard. */
  async watch(contentId: string, episodeId?: string) {
    const content = await this.prisma.content.findFirst({
      where: { id: contentId, status: ContentStatus.PUBLISHED },
    });
    if (!content) {
      throw new NotFoundException('Контент олдсонгүй');
    }

    const assetWhere = episodeId ? { episodeId } : { contentId };
    const [videoAssets, subtitles] = await this.prisma.$transaction([
      this.prisma.videoAsset.findMany({
        where: assetWhere,
        orderBy: { quality: 'desc' },
      }),
      this.prisma.subtitle.findMany({ where: assetWhere }),
    ]);

    return {
      contentId,
      episodeId: episodeId ?? null,
      videoAssets: videoAssets.map((a) => ({
        ...a,
        sizeBytes: a.sizeBytes === null ? null : Number(a.sizeBytes),
      })),
      subtitles,
    };
  }

  listGenres() {
    return this.prisma.genre.findMany({ orderBy: { name: 'asc' } });
  }

  // ----------------------------------------------------------------- admin

  async create(dto: CreateContentDto) {
    const { genres, ...data } = dto;
    try {
      return await this.prisma.content.create({
        data: {
          ...data,
          slug: slugify(dto.title),
          genres: this.genreConnections(genres),
        },
        include: listInclude,
      });
    } catch (err) {
      // Slug already taken — retry once with a random suffix.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        return this.prisma.content.create({
          data: {
            ...data,
            slug: slugWithSuffix(dto.title),
            genres: this.genreConnections(genres),
          },
          include: listInclude,
        });
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdateContentDto) {
    await this.requireContent(id);
    const { genres, ...data } = dto;

    if (genres !== undefined) {
      await this.prisma.contentGenre.deleteMany({ where: { contentId: id } });
    }

    return this.prisma.content.update({
      where: { id },
      data: {
        ...data,
        ...(genres !== undefined
          ? { genres: this.genreConnections(genres) }
          : {}),
      },
      include: listInclude,
    });
  }

  async remove(id: string) {
    await this.requireContent(id);
    await this.prisma.content.delete({ where: { id } });
    return { success: true };
  }

  // Seasons / episodes -------------------------------------------------------

  async addSeason(contentId: string, dto: CreateSeasonDto) {
    await this.requireContent(contentId);
    return this.prisma.season.create({ data: { contentId, ...dto } });
  }

  async removeSeason(seasonId: string) {
    await this.prisma.season.delete({ where: { id: seasonId } }).catch(() => {
      throw new NotFoundException('Улирал олдсонгүй');
    });
    return { success: true };
  }

  async addEpisode(seasonId: string, dto: CreateEpisodeDto) {
    const season = await this.prisma.season.findUnique({ where: { id: seasonId } });
    if (!season) throw new NotFoundException('Улирал олдсонгүй');
    return this.prisma.episode.create({ data: { seasonId, ...dto } });
  }

  async updateEpisode(episodeId: string, dto: Partial<CreateEpisodeDto>) {
    return this.prisma.episode
      .update({ where: { id: episodeId }, data: dto })
      .catch(() => {
        throw new NotFoundException('Анги олдсонгүй');
      });
  }

  async removeEpisode(episodeId: string) {
    await this.prisma.episode.delete({ where: { id: episodeId } }).catch(() => {
      throw new NotFoundException('Анги олдсонгүй');
    });
    return { success: true };
  }

  // Video assets / subtitles -------------------------------------------------

  async addVideoAsset(contentId: string, dto: CreateVideoAssetDto) {
    await this.requireContent(contentId);
    if (!dto.url && !dto.r2Key) {
      throw new BadRequestException('url эсвэл r2Key шаардлагатай');
    }
    const { episodeId, ...data } = dto;
    const asset = await this.prisma.videoAsset.create({
      data: episodeId ? { episodeId, ...data } : { contentId, ...data },
    });
    return { ...asset, sizeBytes: asset.sizeBytes === null ? null : Number(asset.sizeBytes) };
  }

  async removeVideoAsset(assetId: string) {
    await this.prisma.videoAsset.delete({ where: { id: assetId } }).catch(() => {
      throw new NotFoundException('Видео файл олдсонгүй');
    });
    return { success: true };
  }

  async addSubtitle(contentId: string, dto: CreateSubtitleDto) {
    await this.requireContent(contentId);
    if (!dto.url && !dto.r2Key) {
      throw new BadRequestException('url эсвэл r2Key шаардлагатай');
    }
    const { episodeId, ...data } = dto;
    return this.prisma.subtitle.create({
      data: episodeId ? { episodeId, ...data } : { contentId, ...data },
    });
  }

  async removeSubtitle(subtitleId: string) {
    await this.prisma.subtitle.delete({ where: { id: subtitleId } }).catch(() => {
      throw new NotFoundException('Хадмал олдсонгүй');
    });
    return { success: true };
  }

  // --------------------------------------------------------------- helpers

  private async requireContent(id: string) {
    const content = await this.prisma.content.findUnique({ where: { id } });
    if (!content) throw new NotFoundException('Контент олдсонгүй');
    return content;
  }

  /** Nested create linking genre names, creating missing genres on the fly. */
  private genreConnections(names?: string[]) {
    if (!names?.length) return undefined;
    return {
      create: names.map((name) => ({
        genre: {
          connectOrCreate: {
            where: { name },
            create: { name, slug: slugWithSuffix(name) },
          },
        },
      })),
    };
  }
}
