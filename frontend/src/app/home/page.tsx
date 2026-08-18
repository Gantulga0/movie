"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { ContentCard } from "@/components/ContentCard";
import { ContentRow } from "@/components/ContentRow";
import { ContinueWatchingCard } from "@/components/ContinueWatchingCard";
import { useDetails } from "@/components/details/DetailsModalProvider";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  IconBook,
  IconCheck,
  IconInfo,
  IconPlay,
  IconPlus,
} from "@/components/ui/icons";
import { useAuth } from "@/lib/auth-context";
import { activityApi, contentApi } from "@/lib/api";
import type { Content, Genre, HistoryItem } from "@/lib/types";
import { formatDuration, typeLabel, watchedPercent } from "@/lib/format";

const HERO_INTERVAL_MS = 8000;
/** How many genre rails the home page renders. */
const GENRE_ROW_LIMIT = 8;
const ROW_ITEM_LIMIT = 18;

export default function HomePage() {
  return (
    <AppShell>
      <HomeContent />
    </AppShell>
  );
}

function HomeContent() {
  const { user, token } = useAuth();

  const [featured, setFeatured] = useState<Content[]>([]);
  const [featuredLoading, setFeaturedLoading] = useState(true);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [newest, setNewest] = useState<Content[]>([]);
  const [newestLoading, setNewestLoading] = useState(true);
  const [novels, setNovels] = useState<Content[]>([]);
  const [novelsLoading, setNovelsLoading] = useState(true);
  const [genreRows, setGenreRows] = useState<
    Array<{ genre: Genre; items: Content[] }>
  >([]);
  const [genresLoading, setGenresLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    contentApi
      .list({ featured: true, limit: 6 })
      .then((res) => setFeatured(res.items))
      .catch(() => setFeatured([]))
      .finally(() => setFeaturedLoading(false));

    contentApi
      .list({ sort: "new", limit: ROW_ITEM_LIMIT })
      .then((res) => setNewest(res.items))
      .catch(() => setNewest([]))
      .finally(() => setNewestLoading(false));

    // Novels get their own rail — they don't belong in the movie genre rows.
    contentApi
      .list({ type: "NOVEL", sort: "new", limit: ROW_ITEM_LIMIT })
      .then((res) => setNovels(res.items))
      .catch(() => setNovels([]))
      .finally(() => setNovelsLoading(false));

    // Genre rails come from real genre data; empty genres are dropped.
    // Check every genre first, THEN cap the row count — slicing before the
    // content check can land on 8 empty genres and render nothing at all.
    contentApi
      .genres()
      .then(async (genres) => {
        const movieGenres = genres.filter(
          (g) =>
            !g.types?.length ||
            g.types.includes("MOVIE") ||
            g.types.includes("SERIES"),
        );
        const rows = await Promise.all(
          movieGenres.map(async (genre) => {
            const res = await contentApi
              .list({ genre: genre.slug, limit: ROW_ITEM_LIMIT })
              .catch(() => null);
            return { genre, items: res?.items ?? [] };
          }),
        );
        setGenreRows(
          rows.filter((r) => r.items.length > 0).slice(0, GENRE_ROW_LIMIT),
        );
      })
      .catch(() => setGenreRows([]))
      .finally(() => setGenresLoading(false));
  }, [user]);

  useEffect(() => {
    if (!token) return;
    activityApi
      .history(token)
      .then(setHistory)
      .catch(() => setHistory([]));
  }, [token]);

  const removeFromContinue = useCallback(
    (contentId: string) => {
      setHistory((rows) => rows.filter((r) => r.content.id !== contentId));
      if (token)
        activityApi.removeHistory(token, contentId).catch(() => undefined);
    },
    [token],
  );

  // One card per watched *episode* (a movie is its own single entry), newest
  // first. Each episode of a series stays in the rail — watch ep1 then ep2 and
  // both show. Completed items stay too (past the 30s warm-up guard).
  const continueWatching = useMemo(() => {
    const seen = new Set<string>();
    const rows: HistoryItem[] = [];
    for (const row of history) {
      // Novel rows carry no seconds — the chapter itself is the position.
      if (row.progressSec < 30 && !row.completed && !row.chapter) continue;
      const key = `${row.content.id}:${row.episode?.id ?? row.chapter?.id ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(row);
    }
    return rows.slice(0, 20);
  }, [history]);

  // Progress badge for the *poster* cards elsewhere on the page: one value per
  // title, the most recently watched episode (rows are newest-first).
  const progressByContent = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of continueWatching) {
      if (map.has(row.content.id)) continue;
      const duration = row.episode?.durationSec ?? row.content.durationSec;
      const pct = watchedPercent(row.progressSec, duration);
      if (pct != null) map.set(row.content.id, pct);
    }
    return map;
  }, [continueWatching]);

  return (
    <div className="pb-16">
      <HomeHero featured={featured} loading={featuredLoading} />

      {continueWatching.length > 0 ? (
        <ContentRow title="Үргэлжлүүлэх">
          {continueWatching.map((item) => (
            <ContinueWatchingCard
              key={item.id}
              item={item}
              onRemove={removeFromContinue}
            />
          ))}
        </ContentRow>
      ) : null}

      <ContentRow
        title="Шинээр нэмэгдсэн"
        viewAllHref="/browse?sort=new"
        loading={newestLoading}
      >
        {newest.map((content) => (
          <ContentCard
            key={content.id}
            content={content}
            progressPercent={progressByContent.get(content.id)}
          />
        ))}
      </ContentRow>

      {novelsLoading || novels.length > 0 ? (
        <ContentRow
          title="Өгүүллэг"
          viewAllHref="/browse?type=NOVEL"
          loading={novelsLoading}
        >
          {novels.map((content) => (
            <ContentCard
              key={content.id}
              content={content}
              progressPercent={progressByContent.get(content.id)}
            />
          ))}
        </ContentRow>
      ) : null}

      {genresLoading ? (
        <ContentRow title="Ангилал" loading>
          {[]}
        </ContentRow>
      ) : (
        genreRows.map(({ genre, items }) => (
          <ContentRow
            key={genre.id}
            title={genre.name}
            viewAllHref={`/browse?genre=${genre.slug}`}
          >
            {items.map((content) => (
              <ContentCard
                key={content.id}
                content={content}
                progressPercent={progressByContent.get(content.id)}
              />
            ))}
          </ContentRow>
        ))
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function HomeHero({
  featured,
  loading,
}: {
  featured: Content[];
  loading: boolean;
}) {
  const { token } = useAuth();
  const { openDetails } = useDetails();
  const [index, setIndex] = useState(0);
  const [inList, setInList] = useState<Record<string, boolean>>({});

  // Auto-advance while more than one slide exists.
  useEffect(() => {
    if (featured.length < 2) return;
    const id = setInterval(
      () => setIndex((i) => (i + 1) % featured.length),
      HERO_INTERVAL_MS,
    );
    return () => clearInterval(id);
  }, [featured.length]);

  // Which featured titles are on the caller's list (for the +/✓ button).
  useEffect(() => {
    if (!token || featured.length === 0) return;
    activityApi
      .watchlist(token)
      .then((items) => {
        const map: Record<string, boolean> = {};
        for (const it of items) map[it.content.id] = true;
        setInList(map);
      })
      .catch(() => undefined);
  }, [token, featured]);

  const hero = featured[index];

  // A series has no content-level video, so the hero "Watch" button must point
  // at its first episode. Fetch it for the active series slide (cached per id).
  const [firstEpisode, setFirstEpisode] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!hero || hero.type !== "SERIES" || firstEpisode[hero.id] !== undefined) {
      return;
    }
    let cancelled = false;
    contentApi
      .get(hero.slug)
      .then((d) => {
        if (cancelled) return;
        const first = d.seasons[0]?.episodes[0];
        setFirstEpisode((m) => ({ ...m, [hero.id]: first?.id ?? "" }));
      })
      .catch(() => {
        if (!cancelled) setFirstEpisode((m) => ({ ...m, [hero.id]: "" }));
      });
    return () => {
      cancelled = true;
    };
  }, [hero, firstEpisode]);

  const heroEp = hero ? firstEpisode[hero.id] : undefined;
  const watchHref = hero
    ? hero.type === "NOVEL"
      ? `/read/${hero.id}`
      : hero.type === "SERIES" && heroEp
        ? `/watch/${hero.id}?episodeId=${heroEp}`
        : `/watch/${hero.id}`
    : "#";

  async function toggleList(content: Content) {
    if (!token) return;
    const has = inList[content.id];
    setInList((m) => ({ ...m, [content.id]: !has }));
    try {
      if (has) await activityApi.removeWatchlist(token, content.id);
      else await activityApi.addWatchlist(token, content.id);
    } catch {
      setInList((m) => ({ ...m, [content.id]: has }));
    }
  }

  if (loading) {
    return (
      <section className="relative isolate flex min-h-[82svh] items-end overflow-hidden md:min-h-[62vh]">
        <div className="absolute inset-0 -z-10 skeleton rounded-none" />
        <div className="max-w-2xl px-5 pb-14 sm:px-10">
          <Skeleton className="h-12 w-80 max-w-full sm:h-16" />
          <div className="mt-4 flex gap-2">
            <Skeleton className="h-5 w-14" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-16" />
          </div>
          <div className="mt-5 space-y-2">
            <Skeleton className="h-3.5 w-[34rem] max-w-full" />
            <Skeleton className="h-3.5 w-[28rem] max-w-full" />
          </div>
          <div className="mt-7 flex gap-3">
            <Skeleton className="h-12 w-32" />
            <Skeleton className="h-12 w-36" />
          </div>
        </div>
      </section>
    );
  }

  if (!hero) return null;

  return (
    <section className="relative isolate flex min-h-[82svh] items-end overflow-hidden md:min-h-[66vh]">
      {/* Backdrop: portrait poster on phones (banners are wide art that
          crops to nothing on a narrow screen), wide banner from md up. */}
      <div className="absolute inset-0 -z-10">
        {(hero.posterUrl ?? hero.backdropUrl) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${hero.id}-p`}
            src={(hero.posterUrl ?? hero.backdropUrl) as string}
            alt=""
            className="animate-fade animate-kenburns h-full w-full object-cover md:hidden"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : null}
        {(hero.backdropUrl ?? hero.posterUrl) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={hero.id}
            src={(hero.backdropUrl ?? hero.posterUrl) as string}
            alt=""
            className="animate-fade animate-kenburns hidden h-full w-full object-cover md:block"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : (
          <div
            className="h-full w-full"
            style={{
              background:
                "radial-gradient(120% 120% at 75% 15%, #26335e 0%, #131b31 45%, #05080f 100%)",
            }}
          />
        )}
        {/* Readability: narrow screens fade bottom-up so the image stays
            full-bleed; wide screens keep the cinematic left-side fade. */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent sm:bg-gradient-to-r sm:from-background-deep/90 sm:via-background-deep/45 sm:to-transparent" />
        <div className="absolute inset-0 hidden bg-gradient-to-t from-background via-transparent to-background-deep/40 sm:block" />
        {/* Status-bar legibility over bright poster art */}
        <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-background-deep/60 to-transparent md:hidden" />
        <div className="projector-light absolute inset-0" />
      </div>

      <div
        key={hero.id}
        className="animate-rise w-full max-w-2xl px-5 pb-14 sm:px-10"
      >
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-accent">
          Онцлох {typeLabel(hero.type).toLowerCase()}
        </p>
        <button
          type="button"
          onClick={() => openDetails(hero.slug)}
          className="mt-2 block text-left"
        >
          <h1 className="display text-4xl font-bold leading-none text-foreground drop-shadow-lg sm:text-6xl">
            {hero.title}
          </h1>
          {hero.originalTitle ? (
            <p className="mt-1.5 text-base font-medium text-foreground/55">
              {hero.originalTitle}
            </p>
          ) : null}
        </button>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-foreground/70">
          {hero.releaseYear ? (
            <span className="font-semibold text-foreground">
              {hero.releaseYear}
            </span>
          ) : null}
          {hero.genres.slice(0, 3).map((g) => (
            <span
              key={g.genre.id}
              className="rounded-md bg-white/10 px-2 py-0.5 text-xs font-medium text-foreground/80 backdrop-blur-sm"
            >
              {g.genre.name}
            </span>
          ))}
          {hero.durationSec ? (
            <span>{formatDuration(hero.durationSec)}</span>
          ) : null}
        </div>

        {hero.description ? (
          <p className="mt-4 line-clamp-3 max-w-xl text-sm leading-relaxed text-foreground/80 sm:text-base">
            {hero.description}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center gap-2.5">
          <ButtonLink href={watchHref} variant="primary" size="lg">
            {hero.type === "NOVEL" ? <IconBook size={18} /> : <IconPlay size={18} />}
            {hero.type === "NOVEL" ? "Унших" : "Үзэх"}
          </ButtonLink>
          {hero.trailerUrl && hero.type !== "NOVEL" ? (
            <Button
              variant="outline"
              size="lg"
              onClick={() => openDetails(hero.slug, { trailer: true })}
            >
              Трейлер
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="lg"
            onClick={() => openDetails(hero.slug)}
          >
            <IconInfo size={18} />
            Дэлгэрэнгүй
          </Button>
          <Button
            variant="ghost"
            size="lg"
            onClick={() => toggleList(hero)}
            aria-pressed={Boolean(inList[hero.id])}
            aria-label={
              inList[hero.id] ? "Жагсаалтаас хасах" : "Жагсаалтад нэмэх"
            }
          >
            {inList[hero.id] ? <IconCheck size={19} /> : <IconPlus size={19} />}
            Жагсаалт
          </Button>
        </div>
      </div>

      {/* Slide indicators */}
      {featured.length > 1 ? (
        <div className="absolute bottom-6 right-6 flex gap-1.5">
          {featured.map((f, i) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`${i + 1}-р онцлох`}
              aria-current={i === index}
              className={`h-1.5 rounded-full transition-all ${
                i === index
                  ? "w-7 bg-accent"
                  : "w-3.5 bg-white/30 hover:bg-white/50"
              }`}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
