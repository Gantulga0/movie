"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { ContentCard } from "@/components/ContentCard";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { IconBookmark, IconX } from "@/components/ui/icons";
import { useAuth } from "@/lib/auth-context";
import { activityApi } from "@/lib/api";
import { watchedPercent } from "@/lib/format";
import type { HistoryItem, WatchlistItem } from "@/lib/types";

export default function MyListPage() {
  return (
    <AppShell>
      <MyListContent />
    </AppShell>
  );
}

function MyListContent() {
  const { token } = useAuth();

  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

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

  async function removeFromList(contentId: string) {
    if (!token) return;
    setWatchlist((items) => items.filter((i) => i.content.id !== contentId));
    await activityApi.removeWatchlist(token, contentId).catch(() => undefined);
  }

  const removeFromHistory = useCallback(
    (contentId: string) => {
      setHistory((rows) => rows.filter((r) => r.content.id !== contentId));
      if (token)
        activityApi.removeHistory(token, contentId).catch(() => undefined);
    },
    [token],
  );

  // Everything the user has watched — one row per title, newest first.
  // Fully-watched titles stay in the list (they're history, not a queue).
  const watched = useMemo(() => {
    const seen = new Set<string>();
    const rows: HistoryItem[] = [];
    for (const row of history) {
      if (seen.has(row.content.id)) continue;
      seen.add(row.content.id);
      rows.push(row);
    }
    return rows;
  }, [history]);

  return (
    <div className="px-5 py-8 sm:px-10">
      <PageHeader eyebrow="Миний сан" title="Миний жагсаалт" />

      {loading ? (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : watchlist.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={<IconBookmark size={40} />}
            title="Жагсаалт хоосон байна"
            description="Кино, цувралын карт дээрх Жагсаал товчоор дуртай контентоо энд хадгалаарай."
            action={
              <ButtonLink href="/browse" variant="accent">
                Кино хайж эхлэх
              </ButtonLink>
            }
          />
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {watchlist.map((item) => (
            <div key={item.id} className="group/item relative">
              <ContentCard content={item.content} />
              <button
                type="button"
                onClick={() => removeFromList(item.content.id)}
                aria-label={`${item.content.title}-г жагсаалтаас хасах`}
                className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-background-deep/85 text-foreground/80 opacity-0 backdrop-blur-sm transition hover:bg-danger/80 hover:text-white focus-visible:opacity-100 group-hover/item:opacity-100"
              >
                <IconX size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Watched — full history, including titles watched to the end. */}
      {watched.length > 0 ? (
        <section className="mt-12">
          <h2 className="display text-xl font-semibold text-foreground">
            Үзсэн
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {watched.map((item) => (
              <div key={item.id} className="group/item relative">
                <ContentCard
                  content={item.content}
                  progressPercent={
                    item.completed
                      ? null
                      : watchedPercent(
                          item.progressSec,
                          item.episode?.durationSec ?? item.content.durationSec,
                        )
                  }
                />
                <button
                  type="button"
                  onClick={() => removeFromHistory(item.content.id)}
                  aria-label={`${item.content.title}-г үзсэн жагсаалтаас хасах`}
                  className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-background-deep/85 text-foreground/80 opacity-0 backdrop-blur-sm transition hover:bg-danger/80 hover:text-white focus-visible:opacity-100 group-hover/item:opacity-100"
                >
                  <IconX size={15} />
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
