import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Playback gate: a title streams when the caller has a live subscription
 * (and the title is included in it) OR an active one-time rental. Admins
 * bypass the check so they can preview content. Must run after JwtAuthGuard
 * on a route whose ':id' param is the content id.
 */
@Injectable()
export class EntitlementGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { user } = request;
    if (!user) {
      throw new ForbiddenException('Нэвтрэх шаардлагатай');
    }
    if (user.role === Role.ADMIN) {
      return true;
    }

    const contentId: string = request.params.id;
    const content = await this.prisma.content.findUnique({
      where: { id: contentId },
      select: { subscriptionIncluded: true, isRentable: true },
    });
    if (!content) {
      throw new NotFoundException('Контент олдсонгүй');
    }

    const now = new Date();

    if (content.subscriptionIncluded) {
      const subscription = await this.prisma.subscription.findFirst({
        where: {
          userId: user.id,
          status: SubscriptionStatus.ACTIVE,
          endsAt: { gt: now },
        },
      });
      if (subscription) return true;
    }

    const rental = await this.prisma.rental.findFirst({
      where: { userId: user.id, contentId, endsAt: { gt: now } },
    });
    if (rental) return true;

    // Rental-only titles point the client at the rent flow; everything else
    // points at the subscription plans.
    if (content.isRentable && !content.subscriptionIncluded) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'RENTAL_REQUIRED',
        message: 'Энэ контентыг үзэхийн тулд түрээслэх шаардлагатай.',
      });
    }
    throw new ForbiddenException({
      statusCode: 403,
      error: 'SUBSCRIPTION_REQUIRED',
      message: 'Кино үзэхийн тулд эрхийн багц идэвхжүүлнэ үү.',
    });
  }
}
