import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ContentStatus,
  Prisma,
  Role,
  SubscriptionStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { SafeUser } from '../users/users.service';
import { slugify, slugWithSuffix } from '../common/ids';
import { CreateContentDto } from './dto/create-content.dto';
import { UpdateContentDto } from './dto/update-content.dto';
import { ContentSort, QueryContentDto } from './dto/query-content.dto';
import { CreateEpisodeDto, CreateSeasonDto } from './dto/season-episode.dto';
import { CreateSubtitleDto, CreateVideoAssetDto } from './dto/video-asset.dto';

const DEFAULT_PAGE_SIZE = 24;
const RELATED_LIMIT = 12;

/** Card-level include used by list views. */
const listInclude = {
  genres: { include: { genre: true } },
} satisfies Prisma.ContentInclude;

/** List orderings. 'watched'/'rated' rank by activity volume (row counts). */
const SORT_ORDERINGS: Record<
  ContentSort,
  Prisma.ContentOrderByWithRelationInput[]
> = {
  new: [{ createdAt: 'desc' }],
  year: [{ releaseYear: 'desc' }, { createdAt: 'desc' }],
  title: [{ title: 'asc' }],
  watched: [{ watchHistory: { _count: 'desc' } }, { createdAt: 'desc' }],
  rated: [{ ratings: { _count: 'desc' } }, { createdAt: 'desc' }],
};

@Injectable()
export class ContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

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
    if (query.releaseStatus) where.releaseStatus = query.releaseStatus;
    if (query.genre) {
      where.genres = { some: { genre: { slug: query.genre } } };
    }
    if (query.search) {
      // Match either the localized or the original title.
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { originalTitle: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.year) {
      where.releaseYear = query.year;
    } else if (query.yearFrom !== undefined || query.yearTo !== undefined) {
      where.releaseYear = {
        ...(query.yearFrom !== undefined ? { gte: query.yearFrom } : {}),
        ...(query.yearTo !== undefined ? { lte: query.yearTo } : {}),
      };
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;

    // Pure reads run in parallel; the JOIN strategy keeps each one a
    // single SQL statement against the remote database.
    const [items, total] = await Promise.all([
      this.prisma.content.findMany({
        where,
        include: listInclude,
        relationLoadStrategy: 'join',
        orderBy: SORT_ORDERINGS[query.sort ?? 'new'],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.content.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  /** Published titles sharing at least one genre; newest first. */
  async related(idOrSlug: string) {
    const content = await this.prisma.content.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
        status: ContentStatus.PUBLISHED,
      },
      include: { genres: true },
    });
    if (!content) throw new NotFoundException('Контент олдсонгүй');

    const genreIds = content.genres.map((g) => g.genreId);
    return this.prisma.content.findMany({
      where: {
        id: { not: content.id },
        status: ContentStatus.PUBLISHED,
        ...(genreIds.length
          ? { genres: { some: { genreId: { in: genreIds } } } }
          : {}),
      },
      include: listInclude,
      relationLoadStrategy: 'join',
      orderBy: { createdAt: 'desc' },
      take: RELATED_LIMIT,
    });
  }

  /**
   * The caller's access state for one title — what the Watch/Rent buttons
   * should offer. Always computed server-side; the client never decides.
   */
  async access(contentId: string, user: SafeUser) {
    const now = new Date();
    // All three lookups are independent — one parallel burst, not a chain.
    const [content, subscription, rental] = await Promise.all([
      this.prisma.content.findFirst({
        where: { id: contentId, status: ContentStatus.PUBLISHED },
        select: {
          id: true,
          subscriptionIncluded: true,
          isRentable: true,
          rentalPrice: true,
          rentalDurationHours: true,
        },
      }),
      this.prisma.subscription.findFirst({
        where: {
          userId: user.id,
          status: SubscriptionStatus.ACTIVE,
          endsAt: { gt: now },
        },
        orderBy: { endsAt: 'desc' },
        select: { endsAt: true },
      }),
      this.prisma.rental.findFirst({
        where: { userId: user.id, contentId, endsAt: { gt: now } },
        orderBy: { endsAt: 'desc' },
        select: { endsAt: true },
      }),
    ]);
    if (!content) throw new NotFoundException('Контент олдсонгүй');

    const viaSubscription = Boolean(
      content.subscriptionIncluded && subscription,
    );
    const viaRental = Boolean(rental);

    return {
      contentId: content.id,
      canWatch: user.role === Role.ADMIN || viaSubscription || viaRental,
      viaSubscription,
      viaRental,
      rentalEndsAt: rental?.endsAt ?? null,
      subscriptionIncluded: content.subscriptionIncluded,
      isRentable: content.isRentable,
      rentalPrice: content.isRentable ? content.rentalPrice : null,
      rentalDurationHours: content.rentalDurationHours,
    };
  }

  /** Detail view. Video asset URLs are withheld — those come from `watch`. */
  async get(idOrSlug: string, adminView = false) {
    const matcher = { OR: [{ id: idOrSlug }, { slug: idOrSlug }] };
    // One JOIN-loaded content query and the rating aggregate, in parallel —
    // the previous include fan-out plus a chained aggregate cost seconds
    // against the remote database.
    const [content, rating] = await Promise.all([
      this.prisma.content.findFirst({
        where: {
          ...matcher,
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
        relationLoadStrategy: 'join',
      }),
      this.prisma.rating.aggregate({
        where: { content: matcher },
        _avg: { score: true },
        _count: true,
      }),
    ]);
    if (!content) {
      throw new NotFoundException('Контент олдсонгүй');
    }

    return {
      ...content,
      ratingAvg: rating._avg.score,
      ratingCount: rating._count,
    };
  }

  /** Playable stream sources. Callers must pass the EntitlementGuard. */
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

    // R2 assets stream through short-lived signed URLs instead of permanent
    // public links; local-mode files keep their /uploads path. R2 keys never
    // leave the API.
    const signedAssets = await Promise.all(
      videoAssets.map(async (a) => ({
        id: a.id,
        quality: a.quality,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes === null ? null : Number(a.sizeBytes),
        url: await this.resolvePlaybackUrl(a.r2Key, a.url),
      })),
    );
    const signedSubtitles = await Promise.all(
      subtitles.map(async (s) => ({
        id: s.id,
        language: s.language,
        label: s.label,
        url: await this.resolvePlaybackUrl(s.r2Key, s.url),
      })),
    );

    return {
      contentId,
      episodeId: episodeId ?? null,
      videoAssets: signedAssets,
      subtitles: signedSubtitles,
    };
  }

  /** Signed R2 GET URL when possible, otherwise the stored URL. */
  private async resolvePlaybackUrl(
    r2Key: string | null,
    url: string | null,
  ): Promise<string | null> {
    if (r2Key && this.storage.r2Configured) {
      try {
        return await this.storage.presignGetUrl(r2Key);
      } catch {
        return url;
      }
    }
    return url;
  }

  listGenres() {
    return this.prisma.genre.findMany({ orderBy: { name: 'asc' } });
  }

  // ----------------------------------------------------------------- admin

  async create(dto: CreateContentDto) {
    if (dto.isRentable && !dto.rentalPrice) {
      throw new BadRequestException('Түрээслэх бол түрээсийн үнэ шаардлагатай');
    }
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
    const existing = await this.requireContent(id);
    const willBeRentable = dto.isRentable ?? existing.isRentable;
    const effectivePrice = dto.rentalPrice ?? existing.rentalPrice;
    if (willBeRentable && !effectivePrice) {
      throw new BadRequestException('Түрээслэх бол түрээсийн үнэ шаардлагатай');
    }
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
