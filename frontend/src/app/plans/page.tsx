"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { PaymentModal } from "@/components/billing/PaymentModal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { IconCheck } from "@/components/ui/icons";
import { useAuth } from "@/lib/auth-context";
import { ApiError, billingApi } from "@/lib/api";
import type { CheckoutResult, MySubscription, Plan } from "@/lib/types";
import { daysLeft, formatDate, formatMnt } from "@/lib/format";

export default function PlansPage() {
  return (
    <AppShell>
      <PlansContent />
    </AppShell>
  );
}

function PlansContent() {
  const router = useRouter();
  const { token } = useAuth();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [mine, setMine] = useState<MySubscription | null>(null);
  const [checkout, setCheckout] = useState<CheckoutResult | null>(null);
  const [paying, setPaying] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    billingApi
      .plans()
      .then(setPlans)
      .catch(() => setPlans([]))
      .finally(() => setPlansLoading(false));
  }, []);

  const refreshMine = useCallback(() => {
    if (!token) return;
    billingApi
      .me(token)
      .then(setMine)
      .catch(() => undefined);
  }, [token]);

  useEffect(refreshMine, [refreshMine]);

  // Returning from wire.mn's hosted page: ?wpay=<paymentId> lets us finalize
  // and confirm immediately, without waiting on the webhook.
  useEffect(() => {
    if (!token) return;
    const params = new URLSearchParams(window.location.search);
    const wpay = params.get("wpay");
    if (!wpay) return;

    let tries = 0;
    const timer = setInterval(async () => {
      tries += 1;
      const res = await billingApi.check(token, wpay).catch(() => null);
      if (res?.status === "PAID" || tries >= 5) {
        clearInterval(timer);
        refreshMine();
        window.history.replaceState(null, "", "/plans");
      }
    }, 1500);
    return () => clearInterval(timer);
  }, [token, refreshMine]);

  async function startCheckout(plan: Plan) {
    if (!token) return;
    setError("");
    setPaying(plan.id);
    try {
      const res = await billingApi.checkout(token, plan.id);
      // Real wire.mn → hosted checkout page; mock → in-app settle dialog.
      if (res.invoice.checkoutUrl) {
        window.location.href = res.invoice.checkoutUrl;
        return;
      }
      setCheckout(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Алдаа гарлаа.");
    } finally {
      setPaying(null);
    }
  }

  const active = mine?.active ?? null;

  // "Тест …" plans (1₮ payment-flow checks) stay out of the pricing math so
  // they can't skew the per-month baseline or steal the best-value badge.
  const pricedPlans = plans.filter((p) => !p.name.startsWith("Тест"));

  // Per-month framing: everything is compared against the shortest plan.
  const monthsOf = (p: Plan) => Math.max(1, Math.round(p.durationDay / 30));
  const perMonthOf = (p: Plan) => Math.round(p.price / monthsOf(p));
  const basePerMonth =
    pricedPlans.length > 0
      ? perMonthOf(
          pricedPlans.reduce((a, b) => (a.durationDay <= b.durationDay ? a : b)),
        )
      : 0;
  // "Best value" = the cheapest month; on a tie the longer plan wins.
  const bestId =
    pricedPlans.length > 1
      ? pricedPlans.reduce((a, b) =>
          perMonthOf(b) < perMonthOf(a) ||
          (perMonthOf(b) === perMonthOf(a) && b.durationDay > a.durationDay)
            ? b
            : a,
        ).id
      : null;

  return (
    <div className="relative mx-auto max-w-6xl px-5 py-12 sm:px-10">
      {/* Stage light falling on the header */}
      <div
        aria-hidden
        className="projector-light pointer-events-none absolute inset-x-0 -top-12 h-72"
      />

      <header className="relative text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/infinity.png"
          alt=""
          className="mx-auto h-14 w-auto drop-shadow-[0_0_28px_rgba(124,140,255,0.6)]"
        />
        <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.35em] text-accent">
          Infinite Pass
        </p>
        <h1 className="display mt-2 text-4xl font-bold text-foreground sm:text-5xl">
          Эрх сунгах
        </h1>
      </header>

      {/* Current membership strip */}
      {active ? (
        <div className="mx-auto mt-9 flex max-w-xl items-center gap-4 rounded-2xl border border-accent/25 bg-accent/[.07] px-5 py-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/infinity.png"
            alt=""
            className="h-8 w-auto shrink-0 opacity-90"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-foreground">
              Идэвхтэй: {active.plan.name}
            </p>
            <p className="mt-0.5 text-xs text-muted">
              {formatDate(active.endsAt)} хүртэл —{" "}
              <span className="font-semibold text-accent">
                {daysLeft(active.endsAt)} хоног үлдсэн
              </span>
            </p>
          </div>
          <Badge tone="success">Идэвхтэй</Badge>
        </div>
      ) : null}

      {error ? (
        <div className="mx-auto mt-6 max-w-xl rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      {/* Plan cards */}
      {plansLoading ? (
        <div className="mt-11 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-80 rounded-3xl" />
          ))}
        </div>
      ) : (
        <div className="mt-11 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
          {plans.map((plan, i) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              months={monthsOf(plan)}
              perMonth={perMonthOf(plan)}
              basePerMonth={plan.name.startsWith("Тест") ? 0 : basePerMonth}
              isBest={plan.id === bestId}
              renewing={Boolean(active)}
              busy={paying !== null}
              loading={paying === plan.id}
              delayMs={i * 70}
              onSelect={() => startCheckout(plan)}
            />
          ))}
        </div>
      )}

      {/* Subscription history */}
      {mine && mine.history.length > 0 ? (
        <section className="mt-16">
          <h2 className="display text-lg font-semibold text-foreground">
            Төлбөрийн түүх
          </h2>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-surface/60">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
                  <th className="px-4 py-3">Багц</th>
                  <th className="px-4 py-3">Эхэлсэн</th>
                  <th className="px-4 py-3">Дуусах</th>
                  <th className="px-4 py-3">Төлөв</th>
                </tr>
              </thead>
              <tbody>
                {mine.history.map((sub) => (
                  <tr
                    key={sub.id}
                    className="border-b border-line/50 last:border-0"
                  >
                    <td className="px-4 py-3 font-semibold text-foreground">
                      {sub.plan.name}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {formatDate(sub.startedAt)}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {formatDate(sub.endsAt)}
                    </td>
                    <td className="px-4 py-3">
                      <SubStatus status={sub.status} endsAt={sub.endsAt} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {/* Checkout dialog (mock mode only; real payments redirect to wire.mn) */}
      {checkout ? (
        <PaymentModal
          open
          onClose={() => setCheckout(null)}
          title="wire.mn төлбөр"
          subtitle={checkout.plan.name}
          amount={checkout.amount}
          paymentId={checkout.paymentId}
          invoice={checkout.invoice}
          onPaid={refreshMine}
          successContent={
            <div>
              <p className="text-sm text-muted">
                {checkout.plan.name} багц идэвхжлээ. Сайхан үзээрэй!
              </p>
              <Button
                variant="primary"
                size="lg"
                className="mt-5 w-full"
                onClick={() => router.push("/home")}
              >
                Үзэж эхлэх
              </Button>
            </div>
          }
        />
      ) : null}
    </div>
  );
}

function PlanCard({
  plan,
  months,
  perMonth,
  basePerMonth,
  isBest,
  renewing,
  busy,
  loading,
  delayMs,
  onSelect,
}: {
  plan: Plan;
  months: number;
  perMonth: number;
  basePerMonth: number;
  isBest: boolean;
  renewing: boolean;
  busy: boolean;
  loading: boolean;
  delayMs: number;
  onSelect: () => void;
}) {
  const savings =
    basePerMonth > 0 ? Math.round((1 - perMonth / basePerMonth) * 100) : 0;

  const inner = (
    <div
      className={`flex h-full flex-col p-6 ${
        isBest ? "rounded-[calc(1.5rem-1px)] bg-surface" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="display text-xl font-semibold text-foreground">
          {plan.name}
        </p>
        {savings >= 5 ? (
          <span className="rounded-full bg-teal/15 px-2 py-0.5 text-[11px] font-bold tabular-nums text-teal">
            −{savings}%
          </span>
        ) : null}
      </div>

      <p className="mt-4 flex items-baseline gap-1">
        <span className="display text-4xl font-bold tabular-nums text-foreground">
          {formatMnt(perMonth)}
        </span>
        <span className="text-sm font-medium text-muted">/ сар</span>
      </p>
      <p className="mt-1 text-xs tabular-nums text-muted">
        {months > 1
          ? `Нийт ${formatMnt(plan.price)} • ${plan.durationDay} хоног`
          : `${plan.durationDay} хоногийн эрх`}
      </p>

      <div className="my-5 h-px bg-line" aria-hidden />

      <ul className="space-y-2.5 text-[13px] text-foreground/80">
        <PlanFeature>Бүх кино, цуврал, анимэ</PlanFeature>
        <PlanFeature>HD чанараар үзэх</PlanFeature>
        <PlanFeature>{plan.maxDevices} төхөөрөмж дээр нэвтрэх</PlanFeature>
      </ul>

      <div className="mt-auto pt-5" aria-hidden />
      <Button
        variant={isBest ? "accent" : "outline"}
        size="lg"
        className="w-full"
        disabled={busy}
        loading={loading}
        onClick={onSelect}
      >
        {renewing ? "Сунгах" : "Сонгох"}
      </Button>
    </div>
  );

  return (
    <div
      className="animate-rise relative"
      style={{ animationDelay: `${delayMs}ms`, animationFillMode: "backwards" }}
    >
      {isBest ? (
        <>
          <span className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-accent-strong px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white shadow-[0_2px_16px_rgba(93,110,245,0.5)]">
            Хамгийн ашигтай
          </span>
          <div className="h-full rounded-3xl bg-gradient-to-b from-accent via-accent/35 to-accent/10 p-px shadow-[0_8px_40px_rgba(93,110,245,0.25)] transition duration-200 hover:-translate-y-1">
            {inner}
          </div>
        </>
      ) : (
        <div className="h-full rounded-3xl border border-line bg-surface/80 transition duration-200 hover:-translate-y-1 hover:border-line-strong">
          {inner}
        </div>
      )}
    </div>
  );
}

function PlanFeature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
        <IconCheck size={11} />
      </span>
      {children}
    </li>
  );
}

function SubStatus({ status, endsAt }: { status: string; endsAt: string }) {
  const expired = new Date(endsAt) < new Date();
  if (status === "CANCELLED") {
    return <Badge>Цуцалсан</Badge>;
  }
  if (status === "ACTIVE" && !expired) {
    return <Badge tone="success">Идэвхтэй</Badge>;
  }
  return <Badge>Дууссан</Badge>;
}
