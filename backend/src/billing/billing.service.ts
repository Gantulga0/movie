import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Content,
  ContentStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  Role,
  SubscriptionStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WireService } from './wire.service';
import { SafeUser } from '../users/users.service';

/** Card-level content shape rentals are listed with. */
const rentalContentSelect = {
  select: {
    id: true,
    title: true,
    slug: true,
    type: true,
    posterUrl: true,
    releaseYear: true,
    durationSec: true,
    isRentable: true,
    rentalPrice: true,
    subscriptionIncluded: true,
  },
} satisfies { select: Prisma.ContentSelect };

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wire: WireService,
    private readonly config: ConfigService
  ) {}

  /** Public web origin, for building wire.mn hosted-checkout return URLs. */
  private webUrl(): string {
    const explicit = this.config.get<string>('APP_WEB_URL');
    const base =
      explicit ?? this.config.get<string>('CORS_ORIGIN', 'http://localhost:3000').split(',')[0];
    return base.replace(/\/$/, '');
  }

  // ----------------------------------------------------------------- plans

  listPlans() {
    // Price-descending puts the full-catalog "Plus" plan first.
    return this.prisma.plan.findMany({
      where: { active: true },
      orderBy: { price: 'desc' },
    });
  }

  // ---------------------------------------------------------- subscription

  /**
   * The caller's current access state, shown on the account/plans screens.
   * Category-scoped plans mean several subscriptions can be active at once
   * (e.g. «+18 Кино цуврал» + «+18 Уншдаг өгүүллэг»).
   */
  async mySubscription(userId: string) {
    const now = new Date();
    const [actives, history] = await Promise.all([
      this.prisma.subscription.findMany({
        where: {
          userId,
          status: SubscriptionStatus.ACTIVE,
          endsAt: { gt: now },
        },
        orderBy: { endsAt: 'desc' },
        include: { plan: true },
      }),
      this.prisma.subscription.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: { plan: true },
        take: 20,
      }),
    ]);
    return { actives, history };
  }

  // ---------------------------------------------------------------- rentals

  /** The caller's rentals, newest first. The client splits active/expired. */
  myRentals(userId: string) {
    return this.prisma.rental.findMany({
      where: { userId },
      orderBy: { endsAt: 'desc' },
      include: { content: rentalContentSelect },
      take: 50,
    });
  }

  /**
   * Starts a rental purchase. The price always comes from the database —
   * anything the client sends is ignored.
   */
  async rentCheckout(user: SafeUser, contentId: string) {
    const content = await this.prisma.content.findFirst({
      where: { id: contentId, status: ContentStatus.PUBLISHED },
    });
    if (!content) {
      throw new NotFoundException('Контент олдсонгүй');
    }
    if (!content.isRentable || !content.rentalPrice) {
      throw new BadRequestException('Энэ контент түрээслэх боломжгүй');
    }

    const existing = await this.prisma.rental.findFirst({
      where: { userId: user.id, contentId, endsAt: { gt: new Date() } },
    });
    if (existing) {
      throw new BadRequestException('Танд энэ контентын идэвхтэй түрээс байна');
    }

    const payment = await this.prisma.payment.create({
      data: {
        userId: user.id,
        contentId: content.id,
        amount: content.rentalPrice,
        method: PaymentMethod.WIRE,
      },
    });

    const invoice = await this.wire.createCheckout({
      paymentId: payment.id,
      amount: content.rentalPrice,
      description: `${this.config.get('APP_NAME', 'Шивнээ')} — Түрээс: ${content.title}`,
      // wire.mn returns here after the hosted page; the title screen re-checks
      // access on load, and ?wpay lets it finalize immediately.
      successUrl: `${this.webUrl()}/title/${content.slug}?wpay=${payment.id}`,
    });

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { invoiceId: invoice.invoiceId },
    });

    return {
      paymentId: payment.id,
      amount: content.rentalPrice,
      content: {
        id: content.id,
        title: content.title,
        slug: content.slug,
        rentalDurationHours: content.rentalDurationHours,
      },
      invoice,
    };
  }

  // -------------------------------------------------------------- checkout

  /** Creates a PENDING payment and a wire.mn checkout the client can open. */
  async checkout(user: SafeUser, planId: string) {
    const plan = await this.prisma.plan.findFirst({
      where: { id: planId, active: true },
    });
    if (!plan) {
      throw new NotFoundException('Багц олдсонгүй');
    }

    const payment = await this.prisma.payment.create({
      data: {
        userId: user.id,
        planId: plan.id,
        amount: plan.price,
        method: PaymentMethod.WIRE,
      },
    });

    const invoice = await this.wire.createCheckout({
      paymentId: payment.id,
      amount: plan.price,
      description: `${this.config.get('APP_NAME', 'Шивнээ')} — ${plan.name}`,
      // wire.mn returns to the plans page; ?wpay finalizes the moment we land.
      successUrl: `${this.webUrl()}/plans?wpay=${payment.id}`,
    });

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { invoiceId: invoice.invoiceId },
    });

    return {
      paymentId: payment.id,
      amount: plan.price,
      plan: { id: plan.id, name: plan.name, durationDay: plan.durationDay },
      invoice,
    };
  }

  /** Polls the provider; finalizes the payment the moment it lands. */
  async checkPayment(paymentId: string, user: SafeUser) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { subscription: true, rental: true },
    });
    if (!payment) {
      throw new NotFoundException('Төлбөр олдсонгүй');
    }
    if (payment.userId !== user.id && user.role !== Role.ADMIN) {
      throw new ForbiddenException();
    }
    if (payment.status === PaymentStatus.PAID) {
      return {
        status: payment.status,
        subscription: payment.subscription,
        rental: payment.rental,
      };
    }
    if (!payment.invoiceId) {
      return { status: payment.status, subscription: null, rental: null };
    }

    const result = await this.wire.checkPayment(payment.invoiceId);
    if (result.paid && result.paidAmount >= payment.amount) {
      const granted = await this.finalize(payment.id, result.transactionId);
      return { status: PaymentStatus.PAID, ...granted };
    }
    return { status: payment.status, subscription: null, rental: null };
  }

  /**
   * wire.mn webhook. Verifies the signature, then finalizes the matching
   * payment once wire confirms the intent succeeded. Signature failures throw
   * so wire retries; unknown/duplicate events are acknowledged quietly.
   */
  async handleWireWebhook(rawBody: Buffer, signature: string | undefined, clientIp?: string) {
    // Defence in depth: only wire.mn's IP, then a valid signature.
    this.wire.assertAllowedIp(clientIp);
    const event = this.wire.verifyWebhook(rawBody, signature);
    if (event.type !== 'payment_intent.succeeded') {
      return { received: true };
    }
    // The affected resource may sit directly on `data` or under `data.object`.
    const resource = event.data?.object ?? event.data;
    const intentId = (resource?.id as string | undefined) ?? undefined;
    if (!intentId) return { received: true };

    const payment = await this.prisma.payment.findFirst({
      where: { invoiceId: intentId },
    });
    if (!payment || payment.status === PaymentStatus.PAID) {
      return { received: true };
    }
    // Re-confirm with wire before granting entitlement (defence in depth).
    const result = await this.wire.checkPayment(intentId);
    if (result.paid && result.paidAmount >= payment.amount) {
      await this.finalize(payment.id, result.transactionId);
    }
    return { received: true };
  }

  /** Dev helper: settles a mock invoice without a real bank transfer. */
  async mockPay(paymentId: string, user: SafeUser) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });
    if (!payment || payment.userId !== user.id) {
      throw new NotFoundException('Төлбөр олдсонгүй');
    }
    if (this.config.get('NODE_ENV') === 'production' || !this.wire.isMock) {
      throw new ForbiddenException('Mock төлбөр зөвхөн тест орчинд ажиллана');
    }
    if (payment.status === PaymentStatus.PAID) {
      throw new BadRequestException('Төлбөр аль хэдийн төлөгдсөн');
    }
    const granted = await this.finalize(payment.id, `MOCK-TX-${payment.id}`);
    return { status: PaymentStatus.PAID, ...granted };
  }

  /** Admin: hands out subscription time without a payment. */
  async grantSubscription(userId: string, planId: string) {
    const [user, plan] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId } }),
      this.prisma.plan.findUnique({ where: { id: planId } }),
    ]);
    if (!user) throw new NotFoundException('Хэрэглэгч олдсонгүй');
    if (!plan) throw new NotFoundException('Багц олдсонгүй');
    return this.createOrExtendSubscription(userId, plan.id, plan.durationDay);
  }

  // --------------------------------------------------------------- helpers

  /**
   * Marks the payment PAID and grants the purchased entitlement — a
   * subscription for plan payments, a rental for content payments.
   */
  private async finalize(paymentId: string, transactionId: string | null) {
    return this.prisma.$transaction(async (tx) => {
      // Row-level idempotency: only one caller flips PENDING → PAID.
      const { count } = await tx.payment.updateMany({
        where: { id: paymentId, status: PaymentStatus.PENDING },
        data: {
          status: PaymentStatus.PAID,
          transactionId,
          paidAt: new Date(),
        },
      });
      const payment = await tx.payment.findUniqueOrThrow({
        where: { id: paymentId },
        include: {
          plan: true,
          content: true,
          subscription: { include: { plan: true } },
          rental: true,
        },
      });
      if (count === 0) {
        // Someone else (callback vs poll) already finalized it.
        return { subscription: payment.subscription, rental: payment.rental };
      }

      if (payment.plan) {
        const subscription = await this.createOrExtendSubscriptionTx(
          tx,
          payment.userId,
          payment.plan.id,
          payment.plan.durationDay
        );
        await tx.payment.update({
          where: { id: paymentId },
          data: { subscriptionId: subscription.id },
        });
        return { subscription, rental: null };
      }

      if (payment.content) {
        const rental = await this.createOrExtendRentalTx(
          tx,
          payment.userId,
          payment.content,
          paymentId
        );
        return { subscription: null, rental };
      }

      return { subscription: null, rental: null };
    });
  }

  /**
   * Grants the rental entitlement. If an active rental somehow already
   * exists (double payment), the paid time stacks instead of duplicating.
   */
  private async createOrExtendRentalTx(
    tx: Prisma.TransactionClient,
    userId: string,
    content: Content,
    paymentId: string
  ) {
    const now = new Date();
    const durationMs = content.rentalDurationHours * 60 * 60 * 1000;

    const current = await tx.rental.findFirst({
      where: { userId, contentId: content.id, endsAt: { gt: now } },
      orderBy: { endsAt: 'desc' },
    });
    if (current) {
      return tx.rental.update({
        where: { id: current.id },
        data: { endsAt: new Date(current.endsAt.getTime() + durationMs) },
        include: { content: rentalContentSelect },
      });
    }

    return tx.rental.create({
      data: {
        userId,
        contentId: content.id,
        paymentId,
        startsAt: now,
        endsAt: new Date(now.getTime() + durationMs),
      },
      include: { content: rentalContentSelect },
    });
  }

  private createOrExtendSubscription(userId: string, planId: string, durationDay: number) {
    return this.prisma.$transaction((tx) =>
      this.createOrExtendSubscriptionTx(tx, userId, planId, durationDay)
    );
  }

  /**
   * New time stacks on top of remaining active time — but only within the
   * SAME plan scope (genreSlugs). Buying «Plus» on top of an old full-access
   * plan extends it; buying a category plan while holding «Plus» starts a
   * parallel subscription instead of burning overlapping days.
   */
  private async createOrExtendSubscriptionTx(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    userId: string,
    planId: string,
    durationDay: number
  ) {
    const now = new Date();
    const plan = await tx.plan.findUnique({
      where: { id: planId },
      select: { genreSlugs: true },
    });
    const current = await tx.subscription.findFirst({
      where: {
        userId,
        status: SubscriptionStatus.ACTIVE,
        endsAt: { gt: now },
        // Same coverage scope (order-sensitive — seed keeps arrays canonical).
        plan: { genreSlugs: { equals: plan?.genreSlugs ?? [] } },
      },
      orderBy: { endsAt: 'desc' },
    });

    const startsFrom = current && current.endsAt > now ? current.endsAt : now;
    const endsAt = new Date(startsFrom.getTime() + durationDay * 24 * 60 * 60 * 1000);

    return tx.subscription.create({
      data: { userId, planId, startedAt: now, endsAt },
      include: { plan: true },
    });
  }
}
