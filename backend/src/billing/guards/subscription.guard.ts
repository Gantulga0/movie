import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Role, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Lets only users with a live subscription through. Admins bypass the check
 * so they can preview content. Must run after JwtAuthGuard.
 */
@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const { user } = context.switchToHttp().getRequest();
    if (!user) {
      throw new ForbiddenException('Нэвтрэх шаардлагатай');
    }
    if (user.role === Role.ADMIN) {
      return true;
    }

    const active = await this.prisma.subscription.findFirst({
      where: {
        userId: user.id,
        status: SubscriptionStatus.ACTIVE,
        endsAt: { gt: new Date() },
      },
    });

    if (!active) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'SUBSCRIPTION_REQUIRED',
        message: 'Кино үзэхийн тулд эрхийн багц идэвхжүүлнэ үү.',
      });
    }
    return true;
  }
}
