import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ContentStatus, ContentType, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { activePlanScopes, scopesCover } from '../billing/subscription-access';
import { StorageService } from '../storage/storage.service';
import { SafeUser } from '../users/users.service';
import { slugify, slugWithSuffix } from '../common/ids';
import { CreateContentDto } from './dto/create-content.dto';
import { UpdateContentDto } from './dto/update-content.dto';
import { ContentSort, QueryContentDto } from './dto/query-content.dto';
import { CreateEpisodeDto, CreateSeasonDto } from './dto/season-episode.dto';
import { CreateSubtitleDto, CreateVideoAssetDto } from './dto/video-asset.dto';
import { CreateChapterDto, UpdateChapterDto } from './dto/chapter.dto';

const DEFAULT_PAGE_SIZE = 24;
const RELATED_LIMIT = 12;

/** Card-level include used by list views. */
const listInclude = {
  genres: { include: { genre: true } },
} satisfies Prisma.ContentInclude;

/** List orderings. 'watched'/'rated' rank by activity volume (row counts). */
const SORT_ORDERINGS: Record<ContentSort, Prisma.ContentOrderByWithRelationInput[]> = {
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
    private readonly storage: StorageService
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
    if (query.country) where.country = query.country;
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
        ...(genreIds.length ? { genres: { some: { genreId: { in: genreIds } } } } : {}),
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
    // Plan scopes don't depend on the content row; the genre intersection
    // happens in JS afterwards.
    const [content, planScopes, rental] = await Promise.all([
      this.prisma.content.findFirst({
        where: { id: contentId, status: ContentStatus.PUBLISHED },
        select: {
          id: true,
          subscriptionIncluded: true,
          isRentable: true,
          rentalPrice: true,
          rentalDurationHours: true,
          genres: { select: { genre: { select: { slug: true } } } },
        },
      }),
      activePlanScopes(this.prisma, user.id, now),
      this.prisma.rental.findFirst({
        where: { userId: user.id, contentId, endsAt: { gt: now } },
        orderBy: { endsAt: 'desc' },
        select: { endsAt: true },
      }),
    ]);
    if (!content) throw new NotFoundException('Контент олдсонгүй');

    const viaSubscription = Boolean(
      content.subscriptionIncluded &&
        scopesCover(planScopes, content.genres.map((g) => g.genre.slug)),
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
          // Chapter bodies stay behind the entitlement-checked read route.
          chapters: {
            orderBy: { number: 'asc' },
            select: {
              id: true,
              number: true,
              title: true,
              mediaMimeType: true,
              createdAt: true,
            },
          },
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
    if (content.type === ContentType.NOVEL) {
      throw new BadRequestException('Өгүүллэг контентыг тоглуулах боломжгүй');
    }

    // The EntitlementGuard checks access to `contentId`; make sure the
    // requested episode actually belongs to it, or a viewer entitled to a
    // cheap title could stream another title's episodes (IDOR).
    if (episodeId) {
      const episode = await this.prisma.episode.findFirst({
        where: { id: episodeId, season: { contentId } },
        select: { id: true },
      });
      if (!episode) {
        throw new NotFoundException('Анги олдсонгүй');
      }
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
      }))
    );
    const signedSubtitles = await Promise.all(
      subtitles.map(async (s) => ({
        id: s.id,
        language: s.language,
        label: s.label,
        url: await this.resolvePlaybackUrl(s.r2Key, s.url),
      }))
    );

    return {
      contentId,
      episodeId: episodeId ?? null,
      videoAssets: signedAssets,
      subtitles: signedSubtitles,
    };
  }

  /**
   * A chapter with its body/media. The first `freeChapterCount` chapters are
   * open to any signed-in user; the rest require a live subscription OR an
   * active rental — mirroring the EntitlementGuard (admins bypass). Errors
   * reuse the guard's shape so the frontend's ApiError.code handling works
   * unchanged.
   */
  async readChapter(contentId: string, chapterId: string, user: SafeUser) {
    const adminView = user.role === Role.ADMIN;
    const [content, chapter] = await Promise.all([
      this.prisma.content.findFirst({
        where: {
          id: contentId,
          ...(adminView ? {} : { status: ContentStatus.PUBLISHED }),
        },
        select: {
          id: true,
          title: true,
          slug: true,
          type: true,
          freeChapterCount: true,
          subscriptionIncluded: true,
          isRentable: true,
          genres: { select: { genre: { select: { slug: true } } } },
        },
      }),
      // The contentId match blocks reading another title's chapters (IDOR).
      this.prisma.chapter.findFirst({
        where: { id: chapterId, contentId },
      }),
    ]);
    if (!content || content.type !== ContentType.NOVEL) {
      throw new NotFoundException('Контент олдсонгүй');
    }
    if (!chapter) {
      throw new NotFoundException('Бүлэг олдсонгүй');
    }

    const isFree = chapter.number <= content.freeChapterCount;
    if (!isFree && !adminView) {
      const now = new Date();
      const viaSubscription = content.subscriptionIncluded
        ? scopesCover(
            await activePlanScopes(this.prisma, user.id, now),
            content.genres.map((g) => g.genre.slug),
          )
        : false;
      const rental = viaSubscription
        ? null
        : await this.prisma.rental.findFirst({
            where: { userId: user.id, contentId, endsAt: { gt: now } },
            select: { id: true },
          });
      if (!viaSubscription && !rental) {
        // Rental-only novels point the client at the rent flow.
        if (content.isRentable && !content.subscriptionIncluded) {
          throw new ForbiddenException({
            statusCode: 403,
            error: 'RENTAL_REQUIRED',
            message: 'Энэ бүлгийг уншихын тулд түрээслэх шаардлагатай.',
          });
        }
        throw new ForbiddenException({
          statusCode: 403,
          error: 'SUBSCRIPTION_REQUIRED',
          message: 'Энэ бүлгийг уншихын тулд эрхийн багц идэвхжүүлнэ үү.',
        });
      }
    }

    const siblings = await this.prisma.chapter.findMany({
      where: { contentId },
      select: { id: true },
      orderBy: { number: 'asc' },
    });
    const index = siblings.findIndex((c) => c.id === chapter.id);

    return {
      id: chapter.id,
      number: chapter.number,
      title: chapter.title,
      body: chapter.body,
      mediaUrl: await this.resolvePlaybackUrl(chapter.mediaR2Key, chapter.mediaUrl),
      mediaMimeType: chapter.mediaMimeType,
      contentId: content.id,
      isFree,
      content: { title: content.title, slug: content.slug },
      prevId: index > 0 ? siblings[index - 1].id : null,
      nextId: index < siblings.length - 1 ? siblings[index + 1].id : null,
    };
  }

  /** Signed R2 GET URL when possible, otherwise the stored URL. */
  private async resolvePlaybackUrl(
    r2Key: string | null,
    url: string | null
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

  listGenres(type?: ContentType) {
    return this.prisma.genre.findMany({
      where: type ? { types: { has: type } } : undefined,
      orderBy: { name: 'asc' },
    });
  }

  /** Distinct countries across published titles — powers the country filter. */
  async listCountries() {
    const rows = await this.prisma.content.findMany({
      where: { status: ContentStatus.PUBLISHED, country: { not: null } },
      select: { country: true },
      distinct: ['country'],
      orderBy: { country: 'asc' },
    });
    return rows.map((r) => r.country).filter((c): c is string => Boolean(c && c.trim()));
  }

  // ----------------------------------------------------------------- admin

  async create(dto: CreateContentDto) {
    if (dto.isRentable && !dto.rentalPrice) {
      throw new BadRequestException('Түрээслэх бол түрээсийн үнэ шаардлагатай');
    }
    const { genres, ...data } = dto;
    // Novels have no trailer.
    if (dto.type === ContentType.NOVEL) data.trailerUrl = undefined;
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
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
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

    // Novels have no trailer — clear any stored one on type switch too.
    const effectiveType = dto.type ?? existing.type;
    return this.prisma.content.update({
      where: { id },
      data: {
        ...data,
        ...(effectiveType === ContentType.NOVEL ? { trailerUrl: null } : {}),
        ...(genres !== undefined ? { genres: this.genreConnections(genres) } : {}),
      },
      include: listInclude,
    });
  }

  async remove(id: string) {
    await this.requireContent(id);
    // Collect storage keys BEFORE the delete — the DB cascade wipes the rows
    // that hold them. Cleanup itself is fire-and-forget after DB success.
    const keys = await this.collectStorageKeys(id);
    await this.prisma.content.delete({ where: { id } });
    void this.storage.deleteObjects(keys);
    return { success: true };
  }

  // Seasons / episodes -------------------------------------------------------

  async addSeason(contentId: string, dto: CreateSeasonDto) {
    await this.requireContent(contentId);
    return this.prisma.season.create({ data: { contentId, ...dto } });
  }

  async removeSeason(seasonId: string) {
    const [assets, subs] = await Promise.all([
      this.prisma.videoAsset.findMany({
        where: { episode: { seasonId } },
        select: { r2Key: true, url: true },
      }),
      this.prisma.subtitle.findMany({
        where: { episode: { seasonId } },
        select: { r2Key: true, url: true },
      }),
    ]);
    await this.prisma.season.delete({ where: { id: seasonId } }).catch(() => {
      throw new NotFoundException('Улирал олдсонгүй');
    });
    void this.storage.deleteObjects(
      [...assets, ...subs].map((r) => r.r2Key ?? this.storage.keyFromUrl(r.url)),
    );
    return { success: true };
  }

  async addEpisode(seasonId: string, dto: CreateEpisodeDto) {
    const season = await this.prisma.season.findUnique({ where: { id: seasonId } });
    if (!season) throw new NotFoundException('Улирал олдсонгүй');
    return this.prisma.episode.create({ data: { seasonId, ...dto } });
  }

  async updateEpisode(episodeId: string, dto: Partial<CreateEpisodeDto>) {
    return this.prisma.episode.update({ where: { id: episodeId }, data: dto }).catch(() => {
      throw new NotFoundException('Анги олдсонгүй');
    });
  }

  async removeEpisode(episodeId: string) {
    const [assets, subs] = await Promise.all([
      this.prisma.videoAsset.findMany({
        where: { episodeId },
        select: { r2Key: true, url: true },
      }),
      this.prisma.subtitle.findMany({
        where: { episodeId },
        select: { r2Key: true, url: true },
      }),
    ]);
    await this.prisma.episode.delete({ where: { id: episodeId } }).catch(() => {
      throw new NotFoundException('Анги олдсонгүй');
    });
    void this.storage.deleteObjects(
      [...assets, ...subs].map((r) => r.r2Key ?? this.storage.keyFromUrl(r.url)),
    );
    return { success: true };
  }

  // Chapters -----------------------------------------------------------------

  async addChapter(contentId: string, dto: CreateChapterDto) {
    const content = await this.requireContent(contentId);
    if (content.type !== ContentType.NOVEL) {
      throw new BadRequestException('Зөвхөн өгүүллэг контентод бүлэг нэмнэ');
    }
    const body = dto.body?.trim() ? dto.body : '';
    const media = this.normalizeChapterMedia(dto);
    if (!body && !media.mediaUrl && !media.mediaR2Key) {
      throw new BadRequestException('Бүлэгт бичвэр эсвэл медиа файл шаардлагатай');
    }
    try {
      return await this.prisma.chapter.create({
        data: { contentId, number: dto.number, title: dto.title, body, ...media },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new BadRequestException('Бүлгийн дугаар давхардаж байна');
      }
      throw err;
    }
  }

  /** Full chapter (with body) for the admin editor. */
  async getChapterAdmin(chapterId: string) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
    });
    if (!chapter) throw new NotFoundException('Бүлэг олдсонгүй');
    return chapter;
  }

  async updateChapter(chapterId: string, dto: UpdateChapterDto) {
    const existing = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
    });
    if (!existing) throw new NotFoundException('Бүлэг олдсонгүй');

    const media =
      dto.mediaUrl !== undefined ||
      dto.mediaR2Key !== undefined ||
      dto.mediaMimeType !== undefined
        ? this.normalizeChapterMedia(dto)
        : {};

    // A chapter must keep either text or media after the update.
    const nextBody = dto.body !== undefined ? dto.body : existing.body;
    const nextMediaUrl =
      'mediaUrl' in media ? media.mediaUrl : existing.mediaUrl;
    const nextMediaKey =
      'mediaR2Key' in media ? media.mediaR2Key : existing.mediaR2Key;
    if (!nextBody?.trim() && !nextMediaUrl && !nextMediaKey) {
      throw new BadRequestException('Бүлэгт бичвэр эсвэл медиа файл шаардлагатай');
    }

    // Replacing or clearing the media orphans the old R2/local object — clean
    // it up best-effort once the DB write succeeds.
    const oldKey =
      'mediaR2Key' in media && existing.mediaR2Key !== media.mediaR2Key
        ? existing.mediaR2Key
        : null;

    try {
      const updated = await this.prisma.chapter.update({
        where: { id: chapterId },
        data: { ...dto, ...media },
      });
      if (oldKey) void this.storage.deleteObjects([oldKey]);
      return updated;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2002') {
          throw new BadRequestException('Бүлгийн дугаар давхардаж байна');
        }
        if (err.code === 'P2025') {
          throw new NotFoundException('Бүлэг олдсонгүй');
        }
      }
      throw err;
    }
  }

  async removeChapter(chapterId: string) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
      select: { mediaR2Key: true, mediaUrl: true },
    });
    await this.prisma.chapter.delete({ where: { id: chapterId } }).catch(() => {
      throw new NotFoundException('Бүлэг олдсонгүй');
    });
    if (chapter) {
      void this.storage.deleteObjects([
        chapter.mediaR2Key ?? this.storage.keyFromUrl(chapter.mediaUrl),
      ]);
    }
    return { success: true };
  }

  // Video assets / subtitles -------------------------------------------------

  async addVideoAsset(contentId: string, dto: CreateVideoAssetDto) {
    await this.requireContent(contentId);
    if (!dto.url && !dto.r2Key) {
      throw new BadRequestException('url эсвэл r2Key шаардлагатай');
    }
    const { episodeId, url, ...rest } = dto;
    // Defense-in-depth: for R2 assets never persist a permanent public URL —
    // playback only ever resolves through a short-lived signed URL from r2Key.
    const storedUrl = rest.r2Key && this.storage.r2Configured ? null : (url ?? null);
    const asset = await this.prisma.videoAsset.create({
      data: episodeId
        ? { episodeId, url: storedUrl, ...rest }
        : { contentId, url: storedUrl, ...rest },
    });
    return { ...asset, sizeBytes: asset.sizeBytes === null ? null : Number(asset.sizeBytes) };
  }

  async removeVideoAsset(assetId: string) {
    const asset = await this.prisma.videoAsset.findUnique({
      where: { id: assetId },
      select: { r2Key: true, url: true },
    });
    await this.prisma.videoAsset.delete({ where: { id: assetId } }).catch(() => {
      throw new NotFoundException('Видео файл олдсонгүй');
    });
    if (asset) {
      void this.storage.deleteObjects([
        asset.r2Key ?? this.storage.keyFromUrl(asset.url),
      ]);
    }
    return { success: true };
  }

  async addSubtitle(contentId: string, dto: CreateSubtitleDto) {
    await this.requireContent(contentId);
    if (!dto.url && !dto.r2Key) {
      throw new BadRequestException('url эсвэл r2Key шаардлагатай');
    }
    const { episodeId, url, ...rest } = dto;
    const storedUrl = rest.r2Key && this.storage.r2Configured ? null : (url ?? null);
    return this.prisma.subtitle.create({
      data: episodeId
        ? { episodeId, url: storedUrl, ...rest }
        : { contentId, url: storedUrl, ...rest },
    });
  }

  async removeSubtitle(subtitleId: string) {
    const subtitle = await this.prisma.subtitle.findUnique({
      where: { id: subtitleId },
      select: { r2Key: true, url: true },
    });
    await this.prisma.subtitle.delete({ where: { id: subtitleId } }).catch(() => {
      throw new NotFoundException('Хадмал олдсонгүй');
    });
    if (subtitle) {
      void this.storage.deleteObjects([
        subtitle.r2Key ?? this.storage.keyFromUrl(subtitle.url),
      ]);
    }
    return { success: true };
  }

  // --------------------------------------------------------------- helpers

  /**
   * Every storage key a content owns: video assets and subtitles (content- and
   * episode-level), chapter media, poster/backdrop images. Trailer/image URLs
   * that don't point at our storage (e.g. YouTube) resolve to null and drop out.
   */
  private async collectStorageKeys(contentId: string): Promise<Array<string | null>> {
    const content = await this.prisma.content.findUnique({
      where: { id: contentId },
      select: {
        posterUrl: true,
        backdropUrl: true,
        trailerUrl: true,
        chapters: { select: { mediaR2Key: true, mediaUrl: true } },
        videoAssets: { select: { r2Key: true, url: true } },
        subtitles: { select: { r2Key: true, url: true } },
        seasons: {
          select: {
            episodes: {
              select: {
                videoAssets: { select: { r2Key: true, url: true } },
                subtitles: { select: { r2Key: true, url: true } },
              },
            },
          },
        },
      },
    });
    if (!content) return [];

    const fileKey = (row: { r2Key: string | null; url: string | null }) =>
      row.r2Key ?? this.storage.keyFromUrl(row.url);

    return [
      this.storage.keyFromUrl(content.posterUrl),
      this.storage.keyFromUrl(content.backdropUrl),
      this.storage.keyFromUrl(content.trailerUrl),
      ...content.chapters.map((c) => c.mediaR2Key ?? this.storage.keyFromUrl(c.mediaUrl)),
      ...content.videoAssets.map(fileKey),
      ...content.subtitles.map(fileKey),
      ...content.seasons.flatMap((s) =>
        s.episodes.flatMap((e) => [
          ...e.videoAssets.map(fileKey),
          ...e.subtitles.map(fileKey),
        ]),
      ),
    ];
  }

  /** Empty strings clear media; R2-backed media never stores a permanent URL. */
  private normalizeChapterMedia(dto: {
    mediaUrl?: string;
    mediaR2Key?: string;
    mediaMimeType?: string;
  }) {
    const r2Key = dto.mediaR2Key?.trim() || null;
    const url =
      r2Key && this.storage.r2Configured ? null : dto.mediaUrl?.trim() || null;
    return {
      mediaUrl: url,
      mediaR2Key: r2Key,
      mediaMimeType: dto.mediaMimeType?.trim() || null,
    };
  }

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
