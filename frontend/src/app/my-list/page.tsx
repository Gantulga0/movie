"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { ContentCard, CardSkeleton } from "@/components/ContentCard";
import { useAuth } from "@/lib/auth-context";
import { activityApi } from "@/lib/api";
import type { HistoryItem, WatchlistItem } from "@/lib/types";
import { formatDate } from "@/lib/format";

export default function MyListPage() {
  const router = useRouter();
  const { user, token, loading: authLoading } = useAuth();

  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      activityApi.watchlist(token).catch(() => []),
      activityApi.history(token).catch(() => []),
    ])
      .then(([wl, h]) => {
        setWatchlist(wl);
        setHistory(h);
      })
      .finally(() => setLoading(false));
  }, [token]);

  async function remove(contentId: string) {
    if (!token) return;
    setWatchlist((items) => items.filter((i) => i.content.id !== contentId));
    await activityApi.removeWatchlist(token, contentId).catch(() => undefined);
  }

  if (authLoading || !user) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="px-5 py-8 sm:px-10">
        <h1 className="display text-2xl font-semibold text-white sm:text-3xl">
          Миний жагсаалт
        </h1>

        {loading ? (
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : watchlist.length === 0 ? (
          <div className="mt-10 rounded-xl border border-line bg-surface p-10 text-center">
            <p className="text-white/60">Жагсаалт хоосон байна.</p>
            <Link
              href="/home"
              className="mt-3 inline-block text-sm font-semibold text-brand hover:text-brand-hover"
            >
              Кино хайж эхлэх
            </Link>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {watchlist.map((item) => (
              <div key={item.id} className="group/item relative">
                <ContentCard content={item.content} />
                <button
                  type="button"
                  onClick={() => remove(item.content.id)}
                  aria-label={`${item.content.title}-г жагсаалтаас хасах`}
                  className="absolute right-2 top-2 hidden rounded bg-black/80 px-2 py-1 text-xs font-semibold text-white hover:bg-brand group-hover/item:block"
                >
                  Хасах
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Continue watching */}
        {history.length > 0 ? (
          <section className="mt-12">
            <h2 className="display text-xl font-semibold text-white">
              Үзсэн түүх
            </h2>
            <div className="mt-4 space-y-2">
              {history.slice(0, 15).map((item) => (
                <Link
                  key={item.id}
                  href={`/title/${item.content.slug}`}
                  className="flex items-center gap-4 rounded-lg border border-line bg-surface px-4 py-3 transition hover:bg-surface-raised"
                >
                  <div className="h-14 w-10 shrink-0 overflow-hidden rounded bg-white/5">
                    {item.content.posterUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.content.posterUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">
                      {item.content.title}
                      {item.episode
                        ? ` — ${item.episode.number}-р анги`
                        : ""}
                    </p>
                    <p className="text-xs text-white/50">
                      {formatDate(item.watchedAt)}
                      {item.completed ? " • Дууссан" : ""}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-brand">
                    Үргэлжлүүлэх →
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
