"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/lib/auth-context";
import { ApiError, billingApi } from "@/lib/api";
import type { CheckoutResult, MySubscription, Plan } from "@/lib/types";
import { daysLeft, formatDate, formatMnt } from "@/lib/format";

const POLL_MS = 3000;

export default function PlansPage() {
  const router = useRouter();
  const { user, token, loading: authLoading } = useAuth();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [mine, setMine] = useState<MySubscription | null>(null);
  const [checkout, setCheckout] = useState<CheckoutResult | null>(null);
  const [paying, setPaying] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    billingApi.plans().then(setPlans).catch(() => setPlans([]));
  }, []);

  const refreshMine = useCallback(() => {
    if (!token) return;
    billingApi.me(token).then(setMine).catch(() => undefined);
  }, [token]);

  useEffect(refreshMine, [refreshMine]);

  // While the invoice modal is open, poll until the payment lands.
  useEffect(() => {
    if (!checkout || !token || paid) return;
    pollRef.current = setInterval(async () => {
      const res = await billingApi
        .check(token, checkout.paymentId)
        .catch(() => null);
      if (res?.status === "PAID") {
        setPaid(true);
        refreshMine();
      }
    }, POLL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [checkout, token, paid, refreshMine]);

  async function startCheckout(plan: Plan) {
    if (!token) return;
    setError("");
    setPaying(plan.id);
    try {
      const res = await billingApi.checkout(token, plan.id);
      setPaid(false);
      setCheckout(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Алдаа гарлаа.");
    } finally {
      setPaying(null);
    }
  }

  async function mockPay() {
    if (!token || !checkout) return;
    const res = await billingApi
      .mockPay(token, checkout.paymentId)
      .catch(() => null);
    if (res?.status === "PAID") {
      setPaid(true);
      refreshMine();
    }
  }

  function closeModal() {
    setCheckout(null);
    setPaid(false);
  }

  if (authLoading || !user) return null;

  const active = mine?.active ?? null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="mx-auto max-w-5xl px-5 py-10 sm:px-10">
        <header className="text-center">
          <h1 className="display text-3xl font-bold text-white sm:text-4xl">
            Эрхийн багц
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-white/60">
            Нэг багц — бүх кино, цуврал, анимэ. Урт хугацаа сонгох тусам нэг
            сарын үнэ хямдарна.
          </p>
        </header>

        {/* Current subscription state */}
        {active ? (
          <div className="mx-auto mt-8 flex max-w-lg items-center justify-between rounded-xl border border-brand/30 bg-brand/10 px-5 py-4">
            <div>
              <p className="text-sm font-bold text-white">
                Идэвхтэй: {active.plan.name}
              </p>
              <p className="mt-0.5 text-xs text-white/60">
                {formatDate(active.endsAt)} хүртэл — {daysLeft(active.endsAt)}{" "}
                хоног үлдсэн
              </p>
            </div>
            <span className="rounded-full bg-brand px-3 py-1 text-xs font-bold text-white">
              ИДЭВХТЭЙ
            </span>
          </div>
        ) : null}

        {error ? (
          <div className="mx-auto mt-6 max-w-lg rounded-lg border border-brand/40 bg-brand/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {/* Ticket-stub plan cards */}
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan, i) => {
            const months = Math.round(plan.durationDay / 30);
            const perMonth = Math.round(plan.price / months);
            const isBest = i === plans.length - 1;
            return (
              <div
                key={plan.id}
                className={`ticket-notch relative flex flex-col rounded-2xl border bg-surface transition hover:-translate-y-1 ${
                  isBest ? "border-brand/50" : "border-line"
                }`}
              >
                {isBest ? (
                  <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white">
                    Хамгийн ашигтай
                  </span>
                ) : null}

                {/* Stub */}
                <div className="px-6 pb-5 pt-7 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40">
                    Infinite тасалбар
                  </p>
                  <p className="display mt-2 text-2xl font-semibold text-white">
                    {plan.name}
                  </p>
                  <p className="mt-4 text-3xl font-extrabold text-white">
                    {formatMnt(plan.price)}
                  </p>
                  {months > 1 ? (
                    <p className="mt-1 text-xs text-white/50">
                      сард {formatMnt(perMonth)}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-white/50">суурь үнэ</p>
                  )}
                </div>

                <div className="ticket-perforation mx-4 h-px" aria-hidden />

                {/* Body */}
                <div className="flex flex-1 flex-col px-6 pb-6 pt-5">
                  <ul className="space-y-2 text-xs text-white/60">
                    <li>✓ Бүх кино, цуврал</li>
                    <li>✓ HD чанар</li>
                    <li>✓ {plan.durationDay} хоногийн эрх</li>
                  </ul>
                  <button
                    type="button"
                    onClick={() => startCheckout(plan)}
                    disabled={paying !== null}
                    className={`mt-5 w-full rounded-lg py-2.5 text-sm font-bold transition disabled:opacity-60 ${
                      isBest
                        ? "bg-brand text-white hover:bg-brand-hover"
                        : "border border-white/20 bg-white/5 text-white hover:bg-white/15"
                    }`}
                  >
                    {paying === plan.id ? "Түр хүлээнэ үү…" : "Сонгох"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Subscription history */}
        {mine && mine.history.length > 0 ? (
          <section className="mt-14">
            <h2 className="display text-lg font-semibold text-white">
              Төлбөрийн түүх
            </h2>
            <div className="mt-4 overflow-x-auto rounded-xl border border-line">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-white/40">
                    <th className="px-4 py-3">Багц</th>
                    <th className="px-4 py-3">Эхэлсэн</th>
                    <th className="px-4 py-3">Дуусах</th>
                    <th className="px-4 py-3">Төлөв</th>
                  </tr>
                </thead>
                <tbody>
                  {mine.history.map((sub) => (
                    <tr key={sub.id} className="border-b border-line/50">
                      <td className="px-4 py-3 font-semibold text-white">
                        {sub.plan.name}
                      </td>
                      <td className="px-4 py-3 text-white/60">
                        {formatDate(sub.startedAt)}
                      </td>
                      <td className="px-4 py-3 text-white/60">
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
      </main>

      {/* Checkout modal */}
      {checkout ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          role="dialog"
          aria-label="Төлбөр төлөх"
        >
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 sm:p-8">
            {paid ? (
              <div className="text-center">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-green-500/15 text-3xl">
                  ✓
                </div>
                <h2 className="display mt-4 text-2xl font-semibold text-white">
                  Төлбөр амжилттай
                </h2>
                <p className="mt-2 text-sm text-white/60">
                  {checkout.plan.name} багц идэвхжлээ. Сайхан үзээрэй!
                </p>
                <button
                  type="button"
                  onClick={() => router.push("/home")}
                  className="mt-6 w-full rounded-lg bg-brand py-3 text-base font-bold text-white transition hover:bg-brand-hover"
                >
                  Үзэж эхлэх
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="display text-xl font-semibold text-white">
                      QPay төлбөр
                    </h2>
                    <p className="mt-1 text-sm text-white/60">
                      {checkout.plan.name} — {formatMnt(checkout.amount)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeModal}
                    aria-label="Хаах"
                    className="rounded px-2 py-1 text-white/60 hover:bg-white/10 hover:text-white"
                  >
                    ✕
                  </button>
                </div>

                {checkout.invoice.qrImage ? (
                  <div className="mt-5 flex justify-center rounded-xl bg-white p-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`data:image/png;base64,${checkout.invoice.qrImage}`}
                      alt="QPay QR код"
                      className="h-52 w-52"
                    />
                  </div>
                ) : checkout.invoice.mock ? (
                  <div className="mt-5 rounded-xl border border-gold/30 bg-gold/10 px-4 py-5 text-center">
                    <p className="text-sm font-semibold text-gold">
                      Тест горим (QPay холбогдоогүй)
                    </p>
                    <p className="mt-1 text-xs text-white/60">
                      QPay merchant бүртгэл холбогдсоны дараа энд жинхэнэ QR
                      код гарна.
                    </p>
                  </div>
                ) : null}

                {checkout.invoice.urls.length > 0 ? (
                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-white/40">
                      Банкны апп-аар төлөх
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {checkout.invoice.urls.slice(0, 8).map((u) => (
                        <a
                          key={u.name}
                          href={u.link}
                          className="truncate rounded-lg border border-line bg-white/5 px-3 py-2 text-center text-xs font-semibold text-white/80 transition hover:bg-white/10"
                        >
                          {u.description || u.name}
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="mt-5 flex items-center justify-center gap-2 text-sm text-white/50">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-gold" />
                  Төлбөр хүлээгдэж байна…
                </div>

                {checkout.invoice.mock ? (
                  <button
                    type="button"
                    onClick={mockPay}
                    className="mt-4 w-full rounded-lg border border-gold/40 bg-gold/10 py-2.5 text-sm font-bold text-gold transition hover:bg-gold/20"
                  >
                    [Тест] Төлбөр төлөгдсөн гэж үзэх
                  </button>
                ) : null}
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SubStatus({ status, endsAt }: { status: string; endsAt: string }) {
  const expired = new Date(endsAt) < new Date();
  if (status === "CANCELLED") {
    return <span className="text-xs font-bold text-white/40">Цуцалсан</span>;
  }
  if (status === "ACTIVE" && !expired) {
    return <span className="text-xs font-bold text-green-400">Идэвхтэй</span>;
  }
  return <span className="text-xs font-bold text-white/40">Дууссан</span>;
}
