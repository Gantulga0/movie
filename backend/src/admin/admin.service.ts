import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ContentStatus,
  PaymentStatus,
  Prisma,
  Role,
  SubscriptionStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_PAGE_SIZE = 20;

/** Fields safe to show in admin lists (passwordHash never leaves the DB). */
const userSelect = {
  id: true,
  publicId: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  verified: true,
  avatarUrl: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  // ----------------------------------------------------------------- stats

  async stats() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalUsers,
      verifiedUsers,
      activeSubscriptions,
      totalContent,
      publishedContent,
      revenueAll,
      revenueMonth,
      pendingPayments,
      recentPayments,
      recentUsers,
    ] = await this.prisma.$transaction([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { verified: true } }),
      this.prisma.subscription.count({
        where: { status: SubscriptionStatus.ACTIVE, endsAt: { gt: now } },
      }),
      this.prisma.content.count(),
      this.prisma.content.count({
        where: { status: ContentStatus.PUBLISHED },
      }),
      this.prisma.payment.aggregate({
        where: { status: PaymentStatus.PAID },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: { status: PaymentStatus.PAID, paidAt: { gte: monthStart } },
        _sum: { amount: true },
      }),
      this.prisma.payment.count({ where: { status: PaymentStatus.PENDING } }),
      this.prisma.payment.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
        include: {
          user: { select: { publicId: true, name: true, phone: true, email: true } },
          plan: { select: { name: true } },
        },
      }),
      this.prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: userSelect,
      }),
    ]);

    return {
      totalUsers,
      verifiedUsers,
      activeSubscriptions,
      totalContent,
      publishedContent,
      revenueTotal: revenueAll._sum.amount ?? 0,
      revenueThisMonth: revenueMonth._sum.amount ?? 0,
      pendingPayments,
      recentPayments,
      recentUsers,
    };
  }

  // ----------------------------------------------------------------- users

  /** Search matches the 6-digit publicId, email, phone or name. */
  async listUsers(params: { search?: string; page?: number; limit?: number }) {
    const page = params.page ?? 1;
    const limit = params.limit ?? DEFAULT_PAGE_SIZE;

    const where: Prisma.UserWhereInput = params.search
      ? {
          OR: [
            { publicId: { contains: params.search } },
            { email: { contains: params.search, mode: 'insensitive' } },
            { phone: { contains: params.search } },
            { name: { contains: params.search, mode: 'insensitive' } },
          ],
        }
      : {};

    const now = new Date();
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: {
          ...userSelect,
          subscriptions: {
            where: { status: SubscriptionStatus.ACTIVE, endsAt: { gt: now } },
            orderBy: { endsAt: 'desc' },
            take: 1,
            select: { endsAt: true, plan: { select: { name: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: items.map(({ subscriptions, ...user }) => ({
        ...user,
        activeSubscription: subscriptions[0] ?? null,
      })),
      total,
      page,
      limit,
    };
  }

  async getUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        ...userSelect,
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          include: { plan: { select: { name: true, price: true } } },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 30,
          include: { plan: { select: { name: true } } },
        },
      },
    });
    if (!user) throw new NotFoundException('Хэрэглэгч олдсонгүй');
    return user;
  }

  async setUserRole(id: string, role: Role) {
    await this.getUser(id);
    return this.prisma.user.update({
      where: { id },
      data: { role },
      select: userSelect,
    });
  }

  /** Admin: cut off a user's access immediately. */
  async cancelSubscription(subscriptionId: string) {
    return this.prisma.subscription
      .update({
        where: { id: subscriptionId },
        data: { status: SubscriptionStatus.CANCELLED },
      })
      .catch(() => {
        throw new NotFoundException('Эрх олдсонгүй');
      });
  }

  // -------------------------------------------------------------- payments

  async listPayments(params: {
    status?: PaymentStatus;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = params.page ?? 1;
    const limit = params.limit ?? DEFAULT_PAGE_SIZE;

    const where: Prisma.PaymentWhereInput = {
      ...(params.status ? { status: params.status } : {}),
      ...(params.search
        ? {
            user: {
              OR: [
                { publicId: { contains: params.search } },
                { email: { contains: params.search, mode: 'insensitive' } },
                { phone: { contains: params.search } },
              ],
            },
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { publicId: true, name: true, phone: true, email: true } },
          plan: { select: { name: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.payment.count({ where }),
    ]);

    return { items, total, page, limit };
  }
}
