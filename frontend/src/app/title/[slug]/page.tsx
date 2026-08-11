"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { ContentCard } from "@/components/ContentCard";
import { ContentRow } from "@/components/ContentRow";
import { TrailerEmbed } from "@/components/TrailerEmbed";
import { PaymentModal } from "@/components/billing/PaymentModal";
import { AccessOptions } from "@/components/billing/AccessOptions";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ChapterList } from "@/components/details/ChapterList";
import {
  IconBook,
  IconCheck,
  IconClock,
  IconPlay,
  IconPlus,
} from "@/components/ui/icons";
import { useAuth } from "@/lib/auth-context";
import { activityApi, billingApi, contentApi } from "@/lib/api";
import type {
  Content,
  ContentAccess,
  ContentDetail,
  HistoryItem,
  RentCheckoutResult,
  WatchlistItem,
} from "@/lib/types";
import {
  formatDuration,
  formatHours,
  formatRemaining,
  typeLabel,
  watchedPercent,
} from "@/lib/format";

export default function TitlePage() {
  return (
    <AppShell>
      <TitleContent />
    </AppShell>
  );
}

function TitleContent() {
  const { slug } = useParams<{ slug: string }>();
  const { user, token } = useAuth();

  const [content, setContent] = useState<ContentDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [access, setAccess] = useState<ContentAccess | null>(null);
  const [related, setRelated] = useState<Content[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [inList, setInList] = useState(false);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const [myScore, setMyScore] = useState(0);
  const [renting, setRenting] = useState(false);
  const [rentCheckout, setRentCheckout] = useState<RentCheckoutResult | null>(null);
  const [rentError, setRentError] = useState("");

  useEffect(() => {
    if (!slug) return;
    contentApi
      .get(slug)
      .then(setContent)
      .catch(() => setNotFound(true));
    contentApi
      .related(slug)
      .then(setRelated)
      .catch(() => setRelated([]));
  }, [slug]);

  // Personal state loads in parallel with the content; only the
  // entitlement check waits for the resolved content id.
  const [watchlistItems, setWatchlistItems] = useState<WatchlistItem[]>([]);
  useEffect(() => {
    if (!token) return;
    activityApi
      .history(token)
      .then(setHistory)
      .catch(() => setHistory([]));
    activityApi
      .watchlist(token)
      .then(setWatchlistItems)
      .catch(() => undefined);
  }, [token]);

  const contentId = content?.id ?? null;
  useEffect(() => {
    if (!token || !contentId) return;
    contentApi
      .access(contentId, token)
      .then(setAccess)
      .catch(() => setAccess(null));
  }, [token, contentId]);

  useEffect(() => {
    setInList(watchlistItems.some((i) => i.content.id === contentId));
  }, [watchlistItems, contentId]);

  const refreshAccess = useCallback(() => {
    if (!token || !contentId) return;
    contentApi
      .access(contentId, token)
      .then(setAccess)
      .catch(() => undefined);
  }, [token, contentId]);

  // Returning from wire.mn's hosted page: ?wpay=<paymentId> finalizes the
  // rental and re-checks access without waiting on the webhook.
  useEffect(() => {
    if (!token) return;
    const params = new URLSearchParams(window.location.search);
    const wpay = params.get("wpay");
    if (!wpay) return;

    let tries = 0;
    const timer = setInterval(async () => {
      tries += 1;
      const res = await billingApi.check(token, wpay).catch(() => null);
      if (res?.status === "PAID" || tries >= 5) {
        clearInterval(timer);
        refreshAccess();
        activityApi.history(token).then(setHistory).catch(() => undefined);
        window.history.replaceState(null, "", window.location.pathname);
      }
    }, 1500);
    return () => clearInterval(timer);
  }, [token, refreshAccess]);

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

  async function startRent() {
    if (!token || !content) return;
    setRentError("");
    setRenting(true);
    try {
      const res = await billingApi.rent(token, content.id);
      // Real wire.mn → hosted checkout page; mock → in-app settle dialog.
      if (res.invoice.checkoutUrl) {
        window.location.href = res.invoice.checkoutUrl;
        return;
      }
      setRentCheckout(res);
    } catch (err) {
      setRentError(err instanceof Error ? err.message : "Алдаа гарлаа.");
    } finally {
      setRenting(false);
    }
  }

  const resume = useMemo(() => {
    if (!content) return null;
    return (
      history.find(
        (h) => h.content.id === content.id && !h.completed && h.progressSec > 30,
      ) ?? null
    );
  }, [history, content]);

  if (notFound) {
    return (
      <div className="px-5 py-24 sm:px-10">
        <EmptyState
          title="Контент олдсонгүй"
          description="Энэ холбоос хуучирсан эсвэл контент устгагдсан байж болно."
          action={
            <ButtonLink href="/home" variant="accent">
              Нүүр хуудас руу буцах
            </ButtonLink>
          }
        />
      </div>
    );
  }

  if (!content) {
    return (
      <div className="px-5 py-10 sm:px-10">
        <Skeleton className="h-[46vh] w-full rounded-2xl" />
        <Skeleton className="mt-6 h-8 w-72 max-w-full" />
        <div className="mt-4 space-y-2">
          <Skeleton className="h-3.5 w-full max-w-2xl" />
          <Skeleton className="h-3.5 w-4/5 max-w-xl" />
        </div>
      </div>
    );
  }

  const isSeries = content.type === "SERIES";
  const isNovel = content.type === "NOVEL";
  const firstEpisode = content.seasons[0]?.episodes[0];
  const novelResume = isNovel
    ? (history.find((h) => h.content.id === content.id && h.chapter) ?? null)
    : null;
  const watchHref = isNovel
    ? `/read/${content.id}`
    : resume?.episode
      ? `/watch/${content.id}?episodeId=${resume.episode.id}`
      : isSeries && firstEpisode
        ? `/watch/${content.id}?episodeId=${firstEpisode.id}`
        : `/watch/${content.id}`;

  const canWatch = access?.canWatch ?? user?.role === "ADMIN";
  const showAccessOptions = Boolean(access && !canWatch);

  return (
    <div className="pb-16">
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
                  "radial-gradient(120% 120% at 70% 10%, #26335e 0%, #131b31 50%, #0a0e17 100%)",
              }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-background-deep/95 via-background-deep/70 to-background-deep/30" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
          <div className="projector-light absolute inset-0" />
        </div>

        <div className="flex flex-col gap-8 px-5 pb-12 pt-10 sm:px-10 md:flex-row md:items-end">
          {/* Poster */}
          <div className="w-40 shrink-0 overflow-hidden rounded-xl border border-line-strong shadow-pop sm:w-52">
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
                    "linear-gradient(160deg, #1e2a4d 0%, #131b31 55%, #0a0e17 100%)",
                }}
              />
            )}
          </div>

          {/* Meta */}
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-accent">
              {typeLabel(content.type)}
            </p>
            <h1 className="display mt-2 text-4xl font-bold leading-none text-foreground drop-shadow-lg sm:text-5xl">
              {content.title}
            </h1>
            {content.originalTitle ? (
              <p className="mt-1.5 text-base font-medium text-foreground/55">
                {content.originalTitle}
              </p>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-foreground/70">
              {content.releaseYear ? (
                <span className="font-semibold text-foreground">
                  {content.releaseYear}
                </span>
              ) : null}
              {content.ageRating ? (
                <span className="rounded border border-line-strong px-1.5 py-0.5 text-xs">
                  {content.ageRating}
                </span>
              ) : null}
              {!isSeries && content.durationSec ? (
                <span>{formatDuration(content.durationSec)}</span>
              ) : null}
              {isSeries ? (
                <span>
                  {content.seasons.length} улирал •{" "}
                  {content.seasons.reduce((n, s) => n + s.episodes.length, 0)} анги
                </span>
              ) : null}
              {isNovel ? <span>{content.chapters.length} бүлэг</span> : null}
              <Badge
                tone={content.releaseStatus === "RELEASING" ? "teal" : "default"}
              >
                {content.releaseStatus === "RELEASING"
                  ? "Одоо гарч байгаа"
                  : "Гарч дууссан"}
              </Badge>
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
                  href={`/browse?genre=${g.genre.slug}`}
                  className="rounded-md bg-white/10 px-2 py-0.5 text-xs font-medium text-foreground/80 transition hover:bg-white/20"
                >
                  {g.genre.name}
                </Link>
              ))}
            </div>

            <p className="mt-5 text-sm leading-relaxed text-foreground/80 sm:text-base">
              {content.description}
            </p>

            {content.director ? (
              <p className="mt-4 text-sm text-muted">
                <span className="font-semibold text-foreground/80">
                  Найруулагч:
                </span>{" "}
                {content.director}
              </p>
            ) : null}
            {content.cast.length > 0 ? (
              <p className="mt-1.5 text-sm text-muted">
                <span className="font-semibold text-foreground/80">Гол дүрд:</span>{" "}
                {content.cast.join(", ")}
              </p>
            ) : null}

            {/* Rental state / errors */}
            {access?.viaRental && access.rentalEndsAt ? (
              <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-gold/30 bg-gold/10 px-3.5 py-2.5 text-sm text-gold">
                <IconClock size={17} />
                Түрээс: {formatRemaining(access.rentalEndsAt)} үлдсэн
              </div>
            ) : null}
            {rentError ? (
              <div className="mt-4 rounded-lg border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
                {rentError}
              </div>
            ) : null}

            {/* Paywall: ticket vs monthly pass */}
            {showAccessOptions && access ? (
              <AccessOptions
                access={access}
                renting={renting}
                onRent={startRent}
              />
            ) : null}

            {/* Actions */}
            <div className="mt-7 flex flex-wrap items-center gap-2.5">
              {isNovel ? (
                canWatch || content.freeChapterCount > 0 ? (
                  <ButtonLink href={watchHref} variant="primary" size="lg">
                    <IconBook size={18} />
                    {novelResume ? "Үргэлжлүүлэн унших" : "Унших"}
                  </ButtonLink>
                ) : null
              ) : canWatch ? (
                <ButtonLink href={watchHref} variant="primary" size="lg">
                  <IconPlay size={18} />
                  {resume ? "Үргэлжлүүлэх" : "Үзэх"}
                </ButtonLink>
              ) : null}
              {content.trailerUrl ? (
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => setTrailerOpen(true)}
                >
                  Трейлер
                </Button>
              ) : null}
              <Button
                variant="outline"
                size="lg"
                onClick={toggleList}
                aria-pressed={inList}
                className={inList ? "border-accent/50 bg-accent/10" : ""}
              >
                {inList ? <IconCheck size={18} /> : <IconPlus size={18} />}
                {inList ? "Жагсаалтад байгаа" : "Жагсаалт"}
              </Button>
            </div>

            {/* Rating */}
            <div className="mt-5 flex items-center gap-1.5">
              <span className="mr-1 text-sm text-muted">Үнэлэх:</span>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => rate(n)}
                  aria-label={`${n} од`}
                  className={`text-xl transition hover:scale-110 ${
                    n <= myScore
                      ? "text-gold"
                      : "text-foreground/25 hover:text-foreground/60"
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
          <h2 className="display text-xl font-semibold text-foreground">Ангиуд</h2>
          {content.seasons.map((season) => (
            <div key={season.id} className="mt-6">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted">
                {season.title ?? `Улирал ${season.number}`}
              </h3>
              <div className="mt-3 space-y-2">
                {season.episodes.map((ep) => {
                  const row = history.find((h) => h.episode?.id === ep.id);
                  const percent = row
                    ? watchedPercent(row.progressSec, ep.durationSec)
                    : null;
                  return (
                    <Link
                      key={ep.id}
                      href={`/watch/${content.id}?episodeId=${ep.id}`}
                      className="flex items-center gap-4 rounded-xl border border-line bg-surface px-4 py-3 transition hover:bg-surface-raised"
                    >
                      <span className="w-8 shrink-0 text-center text-lg font-bold text-muted/60">
                        {ep.number}
                      </span>
                      <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-md bg-white/[.05]">
                        {ep.thumbnailUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={ep.thumbnailUrl}
                            alt=""
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                        {percent ? (
                          <div className="absolute inset-x-0 bottom-0 h-1 bg-background-deep/70">
                            <div
                              className="h-full bg-accent"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {ep.title}
                        </p>
                        {ep.description ? (
                          <p className="mt-0.5 line-clamp-1 text-xs text-muted">
                            {ep.description}
                          </p>
                        ) : null}
                      </div>
                      {ep.durationSec ? (
                        <span className="shrink-0 text-xs text-muted">
                          {formatDuration(ep.durationSec)}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      ) : null}

      {/* Chapters (novel) */}
      {isNovel && content.chapters.length > 0 ? (
        <section className="px-5 py-10 sm:px-10">
          <ChapterList
            content={content}
            history={history}
            canWatch={Boolean(canWatch)}
          />
        </section>
      ) : null}

      {/* Related */}
      {related.length > 0 ? (
        <ContentRow title="Төстэй контент">
          {related.map((item) => (
            <ContentCard key={item.id} content={item} />
          ))}
        </ContentRow>
      ) : null}

      {/* Trailer dialog */}
      {content.trailerUrl ? (
        <Modal
          open={trailerOpen}
          onClose={() => setTrailerOpen(false)}
          label={`${content.title} — трейлер`}
          size="xl"
          className="overflow-hidden p-0"
        >
          {trailerOpen ? (
            <TrailerEmbed
              url={content.trailerUrl}
              title={content.title}
              className="aspect-video w-full bg-black"
            />
          ) : null}
        </Modal>
      ) : null}

      {/* Rental payment (mock mode only; real payments redirect to wire.mn) */}
      {rentCheckout ? (
        <PaymentModal
          open
          onClose={() => setRentCheckout(null)}
          title="Түрээсийн төлбөр"
          subtitle={content.title}
          amount={rentCheckout.amount}
          paymentId={rentCheckout.paymentId}
          invoice={rentCheckout.invoice}
          onPaid={refreshAccess}
          successContent={
            <div>
              <p className="text-sm text-muted">
                {content.title} —{" "}
                {formatHours(rentCheckout.content.rentalDurationHours)} үзэх эрх
                нээгдлээ.
              </p>
              <ButtonLink
                href={watchHref}
                variant="primary"
                size="lg"
                className="mt-5 w-full"
              >
                <IconPlay size={18} />
                Үзэж эхлэх
              </ButtonLink>
            </div>
          }
        />
      ) : null}
    </div>
  );
}
