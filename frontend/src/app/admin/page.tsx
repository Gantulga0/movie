"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { adminApi } from "@/lib/api";
import type { AdminStats } from "@/lib/types";
import { formatDate, formatMnt } from "@/lib/format";
import { PaymentBadge } from "@/components/PaymentBadge";

export default function AdminDashboard() {
  const { token } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);

  useEffect(() => {
    if (!token) return;
    adminApi.stats(token).then(setStats).catch(() => undefined);
  }, [token]);

  if (!stats) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-brand" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="display text-2xl font-semibold text-white">Хянах самбар</h1>

      {/* KPI tiles */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Нийт хэрэглэгч" value={String(stats.totalUsers)} sub={`${stats.verifiedUsers} баталгаажсан`} />
        <Stat label="Идэвхтэй эрх" value={String(stats.activeSubscriptions)} sub={`${stats.pendingPayments} хүлээгдэж буй төлбөр`} />
        <Stat label="Энэ сарын орлого" value={formatMnt(stats.revenueThisMonth)} sub={`нийт ${formatMnt(stats.revenueTotal)}`} />
        <Stat label="Контент" value={String(stats.publishedContent)} sub={`нийт ${stats.totalContent} (ноорог орсон)`} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Recent payments */}
        <section className="rounded-xl border border-line bg-surface">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="text-sm font-bold text-white">Сүүлийн төлбөрүүд</h2>
            <Link href="/admin/payments" className="text-xs font-semibold text-brand">
              Бүгд →
            </Link>
          </div>
          <div className="divide-y divide-line/50">
            {stats.recentPayments.length === 0 ? (
              <p className="px-5 py-6 text-sm text-white/50">Төлбөр алга.</p>
            ) : (
              stats.recentPayments.map((p) => (
                <div key={p.id} className="flex items-center justify-between px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">
                      {p.user?.name ?? p.user?.phone}
                      <span className="ml-2 text-xs font-normal text-white/40">
                        #{p.user?.publicId}
                      </span>
                    </p>
                    <p className="text-xs text-white/50">
                      {p.plan?.name} • {formatDate(p.createdAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-white">{formatMnt(p.amount)}</p>
                    <PaymentBadge status={p.status} />
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Recent users */}
        <section className="rounded-xl border border-line bg-surface">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="text-sm font-bold text-white">Шинэ хэрэглэгчид</h2>
            <Link href="/admin/users" className="text-xs font-semibold text-brand">
              Бүгд →
            </Link>
          </div>
          <div className="divide-y divide-line/50">
            {stats.recentUsers.map((u) => (
              <div key={u.id} className="flex items-center justify-between px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">
                    {u.name ?? u.phone}
                  </p>
                  <p className="text-xs text-white/50">
                    #{u.publicId} • {formatDate(u.createdAt)}
                  </p>
                </div>
                {u.verified ? (
                  <span className="text-xs font-semibold text-green-400">✓</span>
                ) : (
                  <span className="text-xs text-white/40">баталгаажаагүй</span>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-5 py-4">
      <p className="text-xs font-medium uppercase tracking-wider text-white/40">
        {label}
      </p>
      <p className="mt-2 text-2xl font-extrabold text-white">{value}</p>
      <p className="mt-1 text-xs text-white/50">{sub}</p>
    </div>
  );
}
