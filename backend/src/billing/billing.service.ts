import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PaymentMethod,
  PaymentStatus,
  Role,
  SubscriptionStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QpayService } from './qpay.service';
import { SafeUser } from '../users/users.service';

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly qpay: QpayService,
    private readonly config: ConfigService,
  ) {}

  // ----------------------------------------------------------------- plans

  listPlans() {
    return this.prisma.plan.findMany({
      where: { active: true },
      orderBy: { durationDay: 'asc' },
    });
  }

  // ---------------------------------------------------------- subscription

  /** The caller's current access state, shown on the account/plans screens. */
  async mySubscription(userId: string) {
    const now = new Date();
    const active = await this.prisma.subscription.findFirst({
      where: { userId, status: SubscriptionStatus.ACTIVE, endsAt: { gt: now } },
      orderBy: { endsAt: 'desc' },
      include: { plan: true },
    });
    const history = await this.prisma.subscription.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { plan: true },
      take: 20,
    });
    return { active, history };
  }

  async hasActive(userId: string): Promise<boolean> {
    const sub = await this.prisma.subscription.findFirst({
      where: {
        userId,
        status: SubscriptionStatus.ACTIVE,
        endsAt: { gt: new Date() },
      },
    });
    return Boolean(sub);
  }

  // -------------------------------------------------------------- checkout

  /** Creates a PENDING payment and a QPay invoice the client can render. */
  async checkout(user: SafeUser, planId: string, method?: PaymentMethod) {
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
        method: method ?? PaymentMethod.QPAY,
      },
    });

    const invoice = await this.qpay.createInvoice({
      paymentId: payment.id,
      userPublicId: user.publicId,
      amount: plan.price,
      description: `${this.config.get('APP_NAME', 'Infinite')} — ${plan.name}`,
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
      include: { subscription: true },
    });
    if (!payment) {
      throw new NotFoundException('Төлбөр олдсонгүй');
    }
    if (payment.userId !== user.id && user.role !== Role.ADMIN) {
      throw new ForbiddenException();
    }
    if (payment.status === PaymentStatus.PAID) {
      return { status: payment.status, subscription: payment.subscription };
    }
    if (!payment.invoiceId) {
      return { status: payment.status, subscription: null };
    }

    const result = await this.qpay.checkPayment(payment.invoiceId);
    if (result.paid && result.paidAmount >= payment.amount) {
      const subscription = await this.finalize(payment.id, result.transactionId);
      return { status: PaymentStatus.PAID, subscription };
    }
    return { status: payment.status, subscription: null };
  }

  /** QPay server-to-server callback; also polled from the payment screen. */
  async handleCallback(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });
    if (!payment || payment.status === PaymentStatus.PAID || !payment.invoiceId) {
      return { ok: true };
    }
    const result = await this.qpay.checkPayment(payment.invoiceId);
    if (result.paid && result.paidAmount >= payment.amount) {
      await this.finalize(payment.id, result.transactionId);
    }
    return { ok: true };
  }

  /** Dev helper: settles a mock invoice without a real bank transfer. */
  async mockPay(paymentId: string, user: SafeUser) {
    if (this.config.get('NODE_ENV') === 'production' || !this.qpay.isMock) {
      throw new ForbiddenException('Mock төлбөр зөвхөн тест орчинд ажиллана');
    }
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });
    if (!payment || payment.userId !== user.id) {
      throw new NotFoundException('Төлбөр олдсонгүй');
    }
    if (payment.status === PaymentStatus.PAID) {
      throw new BadRequestException('Төлбөр аль хэдийн төлөгдсөн');
    }
    const subscription = await this.finalize(payment.id, `MOCK-TX-${payment.id}`);
    return { status: PaymentStatus.PAID, subscription };
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

  /** Marks the payment PAID and grants (or extends) the subscription. */
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
        include: { plan: true, subscription: { include: { plan: true } } },
      });
      if (count === 0) {
        // Someone else (callback vs poll) already finalized it.
        return payment.subscription;
      }

      const plan = payment.plan;
      if (!plan) return null;

      const subscription = await this.createOrExtendSubscriptionTx(
        tx,
        payment.userId,
        plan.id,
        plan.durationDay,
      );
      await tx.payment.update({
        where: { id: paymentId },
        data: { subscriptionId: subscription.id },
      });
      return subscription;
    });
  }

  private createOrExtendSubscription(
    userId: string,
    planId: string,
    durationDay: number,
  ) {
    return this.prisma.$transaction((tx) =>
      this.createOrExtendSubscriptionTx(tx, userId, planId, durationDay),
    );
  }

  /** New time stacks on top of any remaining active time. */
  private async createOrExtendSubscriptionTx(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    userId: string,
    planId: string,
    durationDay: number,
  ) {
    const now = new Date();
    const current = await tx.subscription.findFirst({
      where: { userId, status: SubscriptionStatus.ACTIVE, endsAt: { gt: now } },
      orderBy: { endsAt: 'desc' },
    });

    const startsFrom = current && current.endsAt > now ? current.endsAt : now;
    const endsAt = new Date(
      startsFrom.getTime() + durationDay * 24 * 60 * 60 * 1000,
    );

    return tx.subscription.create({
      data: { userId, planId, startedAt: now, endsAt },
      include: { plan: true },
    });
  }
}
