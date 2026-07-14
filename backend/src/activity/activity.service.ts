import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertHistoryDto, UpsertRatingDto } from './dto/activity.dto';

const contentCard = {
  select: {
    id: true,
    title: true,
    slug: true,
    type: true,
    posterUrl: true,
    releaseYear: true,
    durationSec: true,
  },
};

@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------- watchlist

  getWatchlist(userId: string) {
    return this.prisma.watchlist.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { content: contentCard },
    });
  }

  async addToWatchlist(userId: string, contentId: string) {
    const content = await this.prisma.content.findUnique({
      where: { id: contentId },
    });
    if (!content) throw new NotFoundException('Контент олдсонгүй');

    return this.prisma.watchlist.upsert({
      where: { userId_contentId: { userId, contentId } },
      update: {},
      create: { userId, contentId },
      include: { content: contentCard },
    });
  }

  async removeFromWatchlist(userId: string, contentId: string) {
    await this.prisma.watchlist
      .delete({ where: { userId_contentId: { userId, contentId } } })
      .catch(() => undefined);
    return { success: true };
  }

  // ---------------------------------------------------------------- history

  getHistory(userId: string) {
    return this.prisma.watchHistory.findMany({
      where: { userId },
      orderBy: { watchedAt: 'desc' },
      take: 50,
      include: {
        content: contentCard,
        episode: {
          select: {
            id: true,
            number: true,
            title: true,
            durationSec: true,
            seasonId: true,
            season: { select: { number: true } },
          },
        },
      },
    });
  }

  /** Drops a title from Continue Watching (all episode rows included). */
  async removeHistory(userId: string, contentId: string) {
    await this.prisma.watchHistory.deleteMany({ where: { userId, contentId } });
    return { success: true };
  }

  /**
   * Records playback progress. Manual find-then-write because the compound
   * unique contains a nullable episodeId, which Prisma upsert can't target.
   */
  async upsertHistory(userId: string, dto: UpsertHistoryDto) {
    const existing = await this.prisma.watchHistory.findFirst({
      where: {
        userId,
        contentId: dto.contentId,
        episodeId: dto.episodeId ?? null,
      },
    });

    if (existing) {
      return this.prisma.watchHistory.update({
        where: { id: existing.id },
        data: {
          progressSec: dto.progressSec,
          completed: dto.completed ?? existing.completed,
          watchedAt: new Date(),
        },
      });
    }
    return this.prisma.watchHistory.create({
      data: {
        userId,
        contentId: dto.contentId,
        episodeId: dto.episodeId ?? null,
        progressSec: dto.progressSec,
        completed: dto.completed ?? false,
      },
    });
  }

  // ---------------------------------------------------------------- ratings

  async upsertRating(userId: string, dto: UpsertRatingDto) {
    const content = await this.prisma.content.findUnique({
      where: { id: dto.contentId },
    });
    if (!content) throw new NotFoundException('Контент олдсонгүй');

    return this.prisma.rating.upsert({
      where: { userId_contentId: { userId, contentId: dto.contentId } },
      update: { score: dto.score, review: dto.review ?? null },
      create: {
        userId,
        contentId: dto.contentId,
        score: dto.score,
        review: dto.review ?? null,
      },
    });
  }

  async removeRating(userId: string, contentId: string) {
    await this.prisma.rating
      .delete({ where: { userId_contentId: { userId, contentId } } })
      .catch(() => undefined);
    return { success: true };
  }
}
