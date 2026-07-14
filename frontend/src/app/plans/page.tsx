"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { PaymentModal } from "@/components/billing/PaymentModal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
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
    billingApi.me(token).then(setMine).catch(() => undefined);
  }, [token]);

  useEffect(refreshMine, [refreshMine]);

  async function startCheckout(plan: Plan) {
    if (!token) return;
    setError("");
    setPaying(plan.id);
    try {
      const res = await billingApi.checkout(token, plan.id);
      setCheckout(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Алдаа гарлаа.");
    } finally {
      setPaying(null);
    }
  }

  const active = mine?.active ?? null;

  return (
    <div className="mx-auto max-w-5xl px-5 py-10 sm:px-10">
      <header className="text-center">
        <h1 className="display text-3xl font-bold text-foreground sm:text-4xl">
          Эрх сунгах
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted">
          Нэг багц — бүх кино, цуврал, анимэ. Урт хугацаа сонгох тусам нэг
          сарын үнэ хямдарна. Шинэ хугацаа одоогийн эрхийн дээр нэмэгдэнэ.
        </p>
      </header>

      {/* Current subscription state */}
      {active ? (
        <div className="mx-auto mt-8 flex max-w-lg items-center justify-between gap-4 rounded-2xl border border-accent/25 bg-accent/[.08] px-5 py-4">
          <div>
            <p className="text-sm font-bold text-foreground">
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
        <div className="mx-auto mt-6 max-w-lg rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      {/* Ticket-stub plan cards */}
      {plansLoading ? (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan, i) => {
            const months = Math.max(1, Math.round(plan.durationDay / 30));
            const perMonth = Math.round(plan.price / months);
            const isBest = i === plans.length - 1;
            return (
              <div
                key={plan.id}
                className={`ticket-notch relative flex flex-col rounded-2xl border bg-surface shadow-card transition hover:-translate-y-1 ${
                  isBest ? "border-accent/50" : "border-line"
                }`}
              >
                {isBest ? (
                  <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-strong px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white">
                    Хамгийн ашигтай
                  </span>
                ) : null}

                {/* Stub */}
                <div className="px-6 pb-5 pt-7 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-muted">
                    Infinite тасалбар
                  </p>
                  <p className="display mt-2 text-2xl font-semibold text-foreground">
                    {plan.name}
                  </p>
                  <p className="mt-4 text-3xl font-extrabold text-foreground">
                    {formatMnt(plan.price)}
                  </p>
                  {months > 1 ? (
                    <p className="mt-1 text-xs text-muted">
                      сард {formatMnt(perMonth)}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-muted">суурь үнэ</p>
                  )}
                </div>

                <div className="ticket-perforation mx-4 h-px" aria-hidden />

                {/* Body */}
                <div className="flex flex-1 flex-col px-6 pb-6 pt-5">
                  <ul className="space-y-2 text-xs text-muted">
                    <li>✓ Бүх кино, цуврал</li>
                    <li>✓ HD чанар</li>
                    <li>✓ {plan.durationDay} хоногийн эрх</li>
                  </ul>
                  <Button
                    variant={isBest ? "accent" : "outline"}
                    className="mt-5 w-full"
                    disabled={paying !== null}
                    loading={paying === plan.id}
                    onClick={() => startCheckout(plan)}
                  >
                    {active ? "Сунгах" : "Сонгох"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Subscription history */}
      {mine && mine.history.length > 0 ? (
        <section className="mt-14">
          <h2 className="display text-lg font-semibold text-foreground">
            Төлбөрийн түүх
          </h2>
          <div className="mt-4 overflow-x-auto rounded-xl border border-line">
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
                  <tr key={sub.id} className="border-b border-line/50">
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

      {/* Checkout dialog */}
      {checkout ? (
        <PaymentModal
          open
          onClose={() => setCheckout(null)}
          title="QPay төлбөр"
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
