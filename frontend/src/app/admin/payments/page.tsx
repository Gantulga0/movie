"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { adminApi } from "@/lib/api";
import type { Payment } from "@/lib/types";
import { formatDate, formatMnt } from "@/lib/format";
import { PaymentBadge } from "@/components/PaymentBadge";

const STATUSES = [
  { value: "", label: "Бүгд" },
  { value: "PAID", label: "Төлөгдсөн" },
  { value: "PENDING", label: "Хүлээгдэж буй" },
  { value: "FAILED", label: "Амжилтгүй" },
  { value: "REFUNDED", label: "Буцаагдсан" },
];

export default function AdminPaymentsPage() {
  const { token } = useAuth();

  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<Payment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // `load` never touches `loading` itself so the mount effect stays free of
  // synchronous setState; handlers use `reload` to show the spinner.
  const load = useCallback(
    (opts: { status: string; search: string; page: number }) => {
      if (!token) return;
      adminApi
        .payments(token, {
          status: opts.status || undefined,
          search: opts.search || undefined,
          page: opts.page,
          limit: 25,
        })
        .then((res) => {
          setItems(res.items);
          setTotal(res.total);
        })
        .catch(() => setItems([]))
        .finally(() => setLoading(false));
    },
    [token],
  );

  useEffect(() => load({ status: "", search: "", page: 1 }), [load]);

  function reload(opts: { status: string; search: string; page: number }) {
    setLoading(true);
    load(opts);
  }

  const pages = Math.max(1, Math.ceil(total / 25));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="display text-2xl font-semibold text-white">Төлбөр</h1>
        <div className="flex flex-wrap gap-2">
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
              reload({ status: e.target.value, search, page: 1 });
            }}
            aria-label="Төлөв шүүх"
            className="rounded-md border border-white/15 bg-surface px-3 py-2 text-sm text-white outline-none focus:border-brand"
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              reload({ status, search: search.trim(), page: 1 });
            }}
            className="flex gap-2"
          >
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Хэрэглэгчийн ID, имэйл…"
              aria-label="Төлбөр хайх"
              className="w-56 rounded-md border border-white/15 bg-white/5 px-3.5 py-2 text-sm text-white placeholder-white/40 outline-none focus:border-brand"
            />
            <button
              type="submit"
              className="rounded-md bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
            >
              Хайх
            </button>
          </form>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-line bg-surface text-left text-xs uppercase tracking-wider text-white/40">
              <th className="px-4 py-3">Хэрэглэгч</th>
              <th className="px-4 py-3">Багц</th>
              <th className="px-4 py-3">Дүн</th>
              <th className="px-4 py-3">Төлөв</th>
              <th className="px-4 py-3">Үүссэн</th>
              <th className="px-4 py-3">Төлөгдсөн</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-white/40">
                  Ачаалж байна…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-white/40">
                  Төлбөр олдсонгүй.
                </td>
              </tr>
            ) : (
              items.map((p) => (
                <tr key={p.id} className="border-b border-line/50 hover:bg-white/[.02]">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-white">
                      {p.user?.name ?? p.user?.phone}
                    </p>
                    <p className="font-mono text-xs text-gold">#{p.user?.publicId}</p>
                  </td>
                  <td className="px-4 py-3 text-white/70">{p.plan?.name ?? "—"}</td>
                  <td className="px-4 py-3 font-bold text-white">
                    {formatMnt(p.amount)}
                  </td>
                  <td className="px-4 py-3">
                    <PaymentBadge status={p.status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-white/50">
                    {formatDate(p.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-xs text-white/50">
                    {p.paidAt ? formatDate(p.paidAt) : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 ? (
        <div className="mt-4 flex items-center justify-end gap-2 text-sm">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => {
              const p = page - 1;
              setPage(p);
              reload({ status, search: search.trim(), page: p });
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
              reload({ status, search: search.trim(), page: p });
            }}
            className="rounded-md border border-white/15 px-3 py-1.5 text-white/70 disabled:opacity-40"
          >
            Дараах →
          </button>
        </div>
      ) : null}
    </div>
  );
}
