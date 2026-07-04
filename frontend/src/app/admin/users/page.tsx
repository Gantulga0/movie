"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { adminApi, billingApi } from "@/lib/api";
import type { AdminUser, Plan } from "@/lib/types";
import { daysLeft, formatDate } from "@/lib/format";

export default function AdminUsersPage() {
  const { token } = useAuth();

  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [grantFor, setGrantFor] = useState<AdminUser | null>(null);
  const [granting, setGranting] = useState(false);

  const load = useCallback(
    (query: string, pageNum: number) => {
      if (!token) return;
      setLoading(true);
      adminApi
        .users(token, { search: query || undefined, page: pageNum, limit: 20 })
        .then((res) => {
          setUsers(res.items);
          setTotal(res.total);
        })
        .catch(() => setUsers([]))
        .finally(() => setLoading(false));
    },
    [token],
  );

  useEffect(() => load("", 1), [load]);

  useEffect(() => {
    billingApi.plans().then(setPlans).catch(() => undefined);
  }, []);

  function submitSearch(e: FormEvent) {
    e.preventDefault();
    setPage(1);
    load(search.trim(), 1);
  }

  async function grant(planId: string) {
    if (!token || !grantFor) return;
    setGranting(true);
    try {
      await adminApi.grant(token, grantFor.id, planId);
      setGrantFor(null);
      load(search.trim(), page);
    } finally {
      setGranting(false);
    }
  }

  const pages = Math.max(1, Math.ceil(total / 20));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="display text-2xl font-semibold text-white">Хэрэглэгчид</h1>
        <form onSubmit={submitSearch} className="flex gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ID, имэйл, утас, нэрээр хайх…"
            aria-label="Хэрэглэгч хайх"
            className="w-64 rounded-md border border-white/15 bg-white/5 px-3.5 py-2 text-sm text-white placeholder-white/40 outline-none focus:border-brand"
          />
          <button
            type="submit"
            className="rounded-md bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
          >
            Хайх
          </button>
        </form>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-line bg-surface text-left text-xs uppercase tracking-wider text-white/40">
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Нэр / Имэйл</th>
              <th className="px-4 py-3">Утас</th>
              <th className="px-4 py-3">Эрх</th>
              <th className="px-4 py-3">Бүртгүүлсэн</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-white/40">
                  Ачаалж байна…
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-white/40">
                  Хэрэглэгч олдсонгүй.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="border-b border-line/50 hover:bg-white/[.02]">
                  <td className="px-4 py-3 font-mono font-bold text-gold">
                    {u.publicId}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-white">
                      {u.name ?? "—"}
                      {u.role === "ADMIN" ? (
                        <span className="ml-2 rounded bg-brand/20 px-1.5 py-0.5 text-[10px] font-bold text-brand">
                          ADMIN
                        </span>
                      ) : null}
                      {!u.verified ? (
                        <span className="ml-2 text-[10px] text-white/40">
                          баталгаажаагүй
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-white/50">{u.email ?? ""}</p>
                  </td>
                  <td className="px-4 py-3 text-white/70">{u.phone}</td>
                  <td className="px-4 py-3">
                    {u.activeSubscription ? (
                      <span className="text-xs font-semibold text-green-400">
                        {u.activeSubscription.plan.name} •{" "}
                        {daysLeft(u.activeSubscription.endsAt)} хоног
                      </span>
                    ) : (
                      <span className="text-xs text-white/40">Идэвхгүй</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-white/50">
                    {formatDate(u.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setGrantFor(u)}
                      className="rounded-md border border-white/20 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/10"
                    >
                      Эрх олгох
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 ? (
        <div className="mt-4 flex items-center justify-end gap-2 text-sm">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => {
              const p = page - 1;
              setPage(p);
              load(search.trim(), p);
            }}
            className="rounded-md border border-white/15 px-3 py-1.5 text-white/70 disabled:opacity-40"
          >
            ← Өмнөх
          </button>
          <span className="text-white/50">
            {page} / {pages}
          </span>
          <button
            type="button"
            disabled={page >= pages}
            onClick={() => {
              const p = page + 1;
              setPage(p);
              load(search.trim(), p);
            }}
            className="rounded-md border border-white/15 px-3 py-1.5 text-white/70 disabled:opacity-40"
          >
            Дараах →
          </button>
        </div>
      ) : null}

      {/* Grant modal */}
      {grantFor ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          role="dialog"
          aria-label="Эрх олгох"
        >
          <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6">
            <h2 className="text-lg font-bold text-white">Эрх олгох</h2>
            <p className="mt-1 text-sm text-white/60">
              {grantFor.name ?? grantFor.phone}{" "}
              <span className="font-mono text-gold">#{grantFor.publicId}</span>{" "}
              хэрэглэгчид төлбөргүйгээр эрх нэмнэ.
            </p>
            <div className="mt-5 space-y-2">
              {plans.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  disabled={granting}
                  onClick={() => grant(plan.id)}
                  className="flex w-full items-center justify-between rounded-lg border border-line bg-white/5 px-4 py-3 text-sm transition hover:border-brand/50 hover:bg-white/10 disabled:opacity-50"
                >
                  <span className="font-semibold text-white">{plan.name}</span>
                  <span className="text-white/50">{plan.durationDay} хоног</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setGrantFor(null)}
              className="mt-4 w-full rounded-lg py-2 text-sm text-white/60 transition hover:text-white"
            >
              Болих
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
