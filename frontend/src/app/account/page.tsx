"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/lib/auth-context";
import { billingApi } from "@/lib/api";
import type { MySubscription } from "@/lib/types";
import { daysLeft, formatDate } from "@/lib/format";

export default function AccountPage() {
  const router = useRouter();
  const { user, token, loading: authLoading } = useAuth();
  const [mine, setMine] = useState<MySubscription | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!token) return;
    billingApi.me(token).then(setMine).catch(() => undefined);
  }, [token]);

  if (authLoading || !user) return null;

  const active = mine?.active ?? null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="mx-auto max-w-2xl px-5 py-10 sm:px-10">
        <h1 className="display text-2xl font-semibold text-white sm:text-3xl">
          Миний бүртгэл
        </h1>

        {/* Membership card — the publicId is the "seat number" */}
        <div className="ticket-notch mt-6 rounded-2xl border border-line bg-surface">
          <div className="flex items-center justify-between px-6 pb-5 pt-6">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40">
                Infinite гишүүнчлэл
              </p>
              <p className="mt-1.5 text-lg font-bold text-white">
                {user.name ?? user.phone}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40">
                Гишүүний ID
              </p>
              <p className="display mt-1.5 text-2xl font-semibold tracking-[0.15em] text-gold">
                {user.publicId}
              </p>
            </div>
          </div>

          <div className="ticket-perforation mx-4 h-px" aria-hidden />

          <dl className="grid gap-4 px-6 pb-6 pt-5 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-white/40">Утас</dt>
              <dd className="mt-0.5 text-sm text-white">{user.phone}</dd>
            </div>
            <div>
              <dt className="text-xs text-white/40">Имэйл</dt>
              <dd className="mt-0.5 truncate text-sm text-white">
                {user.email ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-white/40">Бүртгүүлсэн</dt>
              <dd className="mt-0.5 text-sm text-white">
                {formatDate(user.createdAt)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-white/40">Эрхийн байдал</dt>
              <dd className="mt-0.5 text-sm">
                {active ? (
                  <span className="font-semibold text-green-400">
                    {active.plan.name} — {daysLeft(active.endsAt)} хоног үлдсэн
                  </span>
                ) : (
                  <span className="text-white/60">Идэвхгүй</span>
                )}
              </dd>
            </div>
          </dl>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/plans"
            className="rounded-md bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-hover"
          >
            {active ? "Эрх сунгах" : "Багц идэвхжүүлэх"}
          </Link>
          <Link
            href="/forgot"
            className="rounded-md border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Нууц үг солих
          </Link>
        </div>
      </main>
    </div>
  );
}
