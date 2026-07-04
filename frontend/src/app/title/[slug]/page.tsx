"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/lib/auth-context";
import { activityApi, contentApi } from "@/lib/api";
import type { ContentDetail } from "@/lib/types";
import { formatDuration } from "@/lib/format";

export default function TitlePage() {
  const router = useRouter();
  const { slug } = useParams<{ slug: string }>();
  const { user, token, loading: authLoading } = useAuth();

  const [content, setContent] = useState<ContentDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [inList, setInList] = useState(false);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const [myScore, setMyScore] = useState(0);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!slug) return;
    contentApi
      .get(slug)
      .then(setContent)
      .catch(() => setNotFound(true));
  }, [slug]);

  // Is this title already on the watchlist?
  useEffect(() => {
    if (!token || !content) return;
    activityApi
      .watchlist(token)
      .then((items) => setInList(items.some((i) => i.content.id === content.id)))
      .catch(() => undefined);
  }, [token, content]);

  async function toggleList() {
    if (!token || !content) return;
    setInList((v) => !v);
    try {
      if (inList) await activityApi.removeWatchlist(token, content.id);
      else await activityApi.addWatchlist(token, content.id);
    } catch {
      setInList((v) => !v);
    }
  }

  async function rate(score: number) {
    if (!token || !content) return;
    setMyScore(score);
    await activityApi
      .rate(token, { contentId: content.id, score })
      .catch(() => setMyScore(0));
  }

  if (authLoading || !user) return null;

  if (notFound) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="px-5 py-24 text-center">
          <p className="text-white/60">Контент олдсонгүй.</p>
          <Link
            href="/home"
            className="mt-3 inline-block text-sm font-semibold text-brand"
          >
            Нүүр хуудас руу буцах
          </Link>
        </div>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-brand" />
        </div>
      </div>
    );
  }

  const isSeries = content.type === "SERIES";
  const firstEpisode = content.seasons[0]?.episodes[0];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Backdrop hero */}
      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10">
          {content.backdropUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={content.backdropUrl}
              alt=""
              className="h-full w-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <div
              className="h-full w-full"
              style={{
                background:
                  "radial-gradient(120% 120% at 70% 10%, #2a1147 0%, #12102b 50%, #08080a 100%)",
              }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/70 to-black/30" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
        </div>

        <div className="flex flex-col gap-8 px-5 pb-12 pt-10 sm:px-10 md:flex-row md:items-end">
          {/* Poster */}
          <div className="w-40 shrink-0 overflow-hidden rounded-xl border border-white/10 shadow-2xl sm:w-52">
            {content.posterUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={content.posterUrl}
                alt={content.title}
                className="aspect-[2/3] w-full object-cover"
              />
            ) : (
              <div
                className="aspect-[2/3] w-full"
                style={{
                  background:
                    "linear-gradient(160deg, #2a1147 0%, #12102b 55%, #0a0a12 100%)",
                }}
              />
            )}
          </div>

          {/* Meta */}
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-white/50">
              {isSeries ? "Цуврал" : "Кино"}
            </p>
            <h1 className="display mt-2 text-4xl font-bold text-white drop-shadow-lg sm:text-5xl">
              {content.title}
            </h1>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-white/70">
              {content.releaseYear ? (
                <span className="font-semibold text-white">{content.releaseYear}</span>
              ) : null}
              {content.ageRating ? (
                <span className="rounded border border-white/25 px-1.5 py-0.5 text-xs">
                  {content.ageRating}
                </span>
              ) : null}
              {content.durationSec ? (
                <span>{formatDuration(content.durationSec)}</span>
              ) : null}
              {content.ratingCount > 0 ? (
                <span className="font-semibold text-gold">
                  ★ {content.ratingAvg?.toFixed(1)} ({content.ratingCount})
                </span>
              ) : null}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {content.genres.map((g) => (
                <Link
                  key={g.genre.id}
                  href={`/home?genre=${g.genre.slug}`}
                  className="rounded bg-white/10 px-2 py-0.5 text-xs font-medium text-white/80 transition hover:bg-white/20"
                >
                  {g.genre.name}
                </Link>
              ))}
            </div>

            <p className="mt-5 text-sm leading-relaxed text-white/80 sm:text-base">
              {content.description}
            </p>

            {content.cast.length > 0 ? (
              <p className="mt-4 text-sm text-white/60">
                <span className="font-semibold text-white/80">Гол дүрд:</span>{" "}
                {content.cast.join(", ")}
              </p>
            ) : null}

            {/* Actions */}
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href={
                  isSeries && firstEpisode
                    ? `/watch/${content.id}?episodeId=${firstEpisode.id}`
                    : `/watch/${content.id}`
                }
                className="rounded-md bg-brand px-7 py-3 text-base font-bold text-white shadow-xl shadow-brand/30 transition hover:bg-brand-hover"
              >
                ▶ Үзэх
              </Link>
              {content.trailerUrl ? (
                <button
                  type="button"
                  onClick={() => setTrailerOpen(true)}
                  className="rounded-md border border-white/25 bg-white/10 px-6 py-3 text-base font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
                >
                  Трейлер
                </button>
              ) : null}
              <button
                type="button"
                onClick={toggleList}
                aria-pressed={inList}
                className={`rounded-md border px-5 py-3 text-base font-semibold transition ${
                  inList
                    ? "border-brand/60 bg-brand/15 text-white"
                    : "border-white/25 bg-white/5 text-white hover:bg-white/15"
                }`}
              >
                {inList ? "✓ Жагсаалтад байгаа" : "+ Жагсаалт"}
              </button>
            </div>

            {/* Rating */}
            <div className="mt-5 flex items-center gap-1.5">
              <span className="mr-1 text-sm text-white/60">Үнэлэх:</span>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => rate(n)}
                  aria-label={`${n} од`}
                  className={`text-xl transition hover:scale-110 ${
                    n <= myScore ? "text-gold" : "text-white/25 hover:text-white/60"
                  }`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Episodes (series) */}
      {isSeries && content.seasons.length > 0 ? (
        <section className="px-5 py-10 sm:px-10">
          <h2 className="display text-xl font-semibold text-white">Ангиуд</h2>
          {content.seasons.map((season) => (
            <div key={season.id} className="mt-6">
              <h3 className="text-sm font-bold uppercase tracking-wider text-white/60">
                {season.title ?? `Улирал ${season.number}`}
              </h3>
              <div className="mt-3 space-y-2">
                {season.episodes.map((ep) => (
                  <Link
                    key={ep.id}
                    href={`/watch/${content.id}?episodeId=${ep.id}`}
                    className="flex items-center gap-4 rounded-lg border border-line bg-surface px-4 py-3 transition hover:bg-surface-raised"
                  >
                    <span className="w-8 shrink-0 text-center text-lg font-bold text-white/40">
                      {ep.number}
                    </span>
                    <div className="h-14 w-24 shrink-0 overflow-hidden rounded bg-white/5">
                      {ep.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={ep.thumbnailUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">
                        {ep.title}
                      </p>
                      {ep.description ? (
                        <p className="mt-0.5 line-clamp-1 text-xs text-white/50">
                          {ep.description}
                        </p>
                      ) : null}
                    </div>
                    {ep.durationSec ? (
                      <span className="shrink-0 text-xs text-white/50">
                        {formatDuration(ep.durationSec)}
                      </span>
                    ) : null}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </section>
      ) : null}

      {/* Trailer modal */}
      {trailerOpen && content.trailerUrl ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          role="dialog"
          aria-label="Трейлер"
          onClick={() => setTrailerOpen(false)}
        >
          <div
            className="w-full max-w-4xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-end pb-2">
              <button
                type="button"
                onClick={() => setTrailerOpen(false)}
                className="rounded px-3 py-1 text-sm font-semibold text-white/80 hover:bg-white/10 hover:text-white"
              >
                Хаах ✕
              </button>
            </div>
            <video
              src={content.trailerUrl}
              controls
              autoPlay
              className="aspect-video w-full rounded-lg bg-black"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
