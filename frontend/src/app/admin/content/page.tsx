"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { adminApi } from "@/lib/api";
import type { Content } from "@/lib/types";
import { formatDate } from "@/lib/format";

const STATUS_LABEL: Record<string, [string, string]> = {
  PUBLISHED: ["Нийтэлсэн", "text-green-400"],
  DRAFT: ["Ноорог", "text-gold"],
  ARCHIVED: ["Архивласан", "text-white/40"],
};

export default function AdminContentPage() {
  const { token } = useAuth();

  const [items, setItems] = useState<Content[]>([]);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // `load` never touches `loading` itself so the mount effect stays free of
  // synchronous setState; handlers use `reload` to show the spinner.
  const load = useCallback(
    (opts: { status: string; search: string }) => {
      if (!token) return;
      adminApi
        .contentList(token, {
          status: opts.status || undefined,
          search: opts.search || undefined,
          limit: 100,
        })
        .then((res) => setItems(res.items))
        .catch(() => setItems([]))
        .finally(() => setLoading(false));
    },
    [token],
  );

  useEffect(() => load({ status: "", search: "" }), [load]);

  function reload(opts: { status: string; search: string }) {
    setLoading(true);
    load(opts);
  }

  async function remove(content: Content) {
    if (!token) return;
    if (!window.confirm(`"${content.title}"-г бүрмөсөн устгах уу?`)) return;
    await adminApi.contentDelete(token, content.id).catch(() => undefined);
    load({ status, search: search.trim() });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="display text-2xl font-semibold text-white">Контент</h1>
        <div className="flex flex-wrap gap-2">
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              reload({ status: e.target.value, search: search.trim() });
            }}
            aria-label="Төлөв шүүх"
            className="rounded-md border border-white/15 bg-surface px-3 py-2 text-sm text-white outline-none focus:border-brand"
          >
            <option value="">Бүх төлөв</option>
            <option value="PUBLISHED">Нийтэлсэн</option>
            <option value="DRAFT">Ноорог</option>
            <option value="ARCHIVED">Архивласан</option>
          </select>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              reload({ status, search: search.trim() });
            }}
          >
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Гарчгаар хайх…"
              aria-label="Контент хайх"
              className="w-52 rounded-md border border-white/15 bg-white/5 px-3.5 py-2 text-sm text-white placeholder-white/40 outline-none focus:border-brand"
            />
          </form>
          <Link
            href="/admin/content/new"
            className="rounded-md bg-brand px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-hover"
          >
            + Шинэ контент
          </Link>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-line bg-surface text-left text-xs uppercase tracking-wider text-white/40">
              <th className="px-4 py-3">Гарчиг</th>
              <th className="px-4 py-3">Төрөл</th>
              <th className="px-4 py-3">Он</th>
              <th className="px-4 py-3">Төлөв</th>
              <th className="px-4 py-3">Онцлох</th>
              <th className="px-4 py-3">Нэмэгдсэн</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-white/40">
                  Ачаалж байна…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-white/40">
                  Контент алга. Эхнийхээ нэмээрэй.
                </td>
              </tr>
            ) : (
              items.map((c) => {
                const [label, cls] = STATUS_LABEL[c.status] ?? [c.status, ""];
                return (
                  <tr key={c.id} className="border-b border-line/50 hover:bg-white/[.02]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-8 shrink-0 overflow-hidden rounded bg-white/5">
                          {c.posterUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={c.posterUrl}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-white">{c.title}</p>
                          <p className="truncate text-xs text-white/40">
                            {c.genres.map((g) => g.genre.name).join(", ")}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-white/70">
                      {c.type === "SERIES" ? "Цуврал" : "Кино"}
                    </td>
                    <td className="px-4 py-3 text-white/70">{c.releaseYear ?? "—"}</td>
                    <td className={`px-4 py-3 text-xs font-semibold ${cls}`}>{label}</td>
                    <td className="px-4 py-3">
                      {c.featured ? <span className="text-gold">★</span> : null}
                    </td>
                    <td className="px-4 py-3 text-xs text-white/50">
                      {formatDate(c.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/admin/content/${c.id}`}
                          className="rounded-md border border-white/20 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/10"
                        >
                          Засах
                        </Link>
                        <button
                          type="button"
                          onClick={() => remove(c)}
                          className="rounded-md border border-brand/40 px-3 py-1.5 text-xs font-semibold text-brand transition hover:bg-brand/10"
                        >
                          Устгах
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
