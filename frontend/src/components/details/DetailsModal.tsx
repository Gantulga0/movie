"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { activityApi, billingApi, contentApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type {
  Content,
  ContentAccess,
  ContentDetail,
  HistoryItem,
  RentCheckoutResult,
  WatchlistItem,
} from "@/lib/types";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink, Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { PaymentModal } from "@/components/billing/PaymentModal";
import { AccessOptions } from "@/components/billing/AccessOptions";
import { useDetails } from "./DetailsModalProvider";
import {
  IconCheck,
  IconClock,
  IconInfo,
  IconPlay,
  IconPlus,
} from "@/components/ui/icons";
import {
  formatDuration,
  formatHours,
  formatRemaining,
  formatTimestamp,
  watchedPercent,
} from "@/lib/format";

/** Progress below this isn't worth resuming. */
const RESUME_MIN_SEC = 30;

interface DetailsModalProps {
  slug: string;
  /** Start with the trailer already open (hero "Трейлер" action). */
  initialTrailer?: boolean;
  onClose: () => void;
}

/**
 * The cinematic details dialog: backdrop, lazy trailer, full metadata,
 * entitlement-aware actions (watch / resume / rent), episodes and related.
 */
export function DetailsModal({
  slug,
  initialTrailer = false,
  onClose,
}: DetailsModalProps) {
  const { token, user } = useAuth();
  const { openDetails } = useDetails();
  const toast = useToast();

  const [content, setContent] = useState<ContentDetail | null>(null);
  const [failed, setFailed] = useState(false);
  const [access, setAccess] = useState<ContentAccess | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [related, setRelated] = useState<Content[]>([]);
  const [inList, setInList] = useState(false);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const [renting, setRenting] = useState(false);
  const [rentCheckout, setRentCheckout] = useState<RentCheckoutResult | null>(null);
  const [rentError, setRentError] = useState("");

  // Reset transient state whenever the modal switches titles.
  useEffect(() => {
    setContent(null);
    setFailed(false);
    setAccess(null);
    setRelated([]);
    setTrailerOpen(initialTrailer);
    setRentError("");

    contentApi
      .get(slug)
      .then(setContent)
      .catch(() => setFailed(true));
    contentApi
      .related(slug)
      .then(setRelated)
      .catch(() => setRelated([]));
  }, [slug, initialTrailer]);

  // Personal state doesn't need the content id — it loads alongside the
  // content itself instead of waiting behind it.
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

  // Only the entitlement check truly needs the resolved content id.
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

  async function toggleList() {
    if (!token || !content) return;
    setInList((v) => !v);
    try {
      if (inList) {
        await activityApi.removeWatchlist(token, content.id);
        toast.info("Жагсаалтаас хасагдлаа.");
      } else {
        await activityApi.addWatchlist(token, content.id);
        toast.success("Миний жагсаалтад нэмэгдлээ.");
      }
    } catch {
      setInList((v) => !v);
      toast.error("Жагсаалт шинэчлэхэд алдаа гарлаа.");
    }
  }

  async function startRent() {
    if (!token || !content) return;
    setRentError("");
    setRenting(true);
    try {
      const res = await billingApi.rent(token, content.id);
      setRentCheckout(res);
    } catch (err) {
      setRentError(err instanceof Error ? err.message : "Алдаа гарлаа.");
    } finally {
      setRenting(false);
    }
  }

  // Resume point: the most recent unfinished history row for this title.
  const resume = useMemo(() => {
    if (!content) return null;
    const row = history.find(
      (h) =>
        h.content.id === content.id && !h.completed && h.progressSec > RESUME_MIN_SEC,
    );
    return row ?? null;
  }, [history, content]);

  const isSeries = content?.type === "SERIES";
  const firstEpisode = content?.seasons[0]?.episodes[0];

  const watchHref = useMemo(() => {
    if (!content) return "#";
    if (resume?.episode) return `/watch/${content.id}?episodeId=${resume.episode.id}`;
    if (isSeries && firstEpisode)
      return `/watch/${content.id}?episodeId=${firstEpisode.id}`;
    return `/watch/${content.id}`;
  }, [content, resume, isSeries, firstEpisode]);

  const episodeCount = useMemo(
    () => content?.seasons.reduce((sum, s) => sum + s.episodes.length, 0) ?? 0,
    [content],
  );

  // Access decisions come from the backend; admins can always preview.
  const canWatch = access?.canWatch ?? user?.role === "ADMIN";
  const showAccessOptions = Boolean(access && !canWatch);

  return (
    <>
      <Modal
        open
        onClose={onClose}
        label={content?.title ?? "Дэлгэрэнгүй"}
        size="xl"
        className="overflow-hidden p-0"
      >
        {failed ? (
          <div className="px-6 py-16 text-center">
            <p className="text-muted">Контент олдсонгүй.</p>
          </div>
        ) : !content ? (
          <DetailsSkeleton />
        ) : (
          <div className="max-h-[85vh] overflow-y-auto">
            {/* Backdrop / trailer stage */}
            <div className="relative aspect-video max-h-[46vh] w-full overflow-hidden bg-background-deep">
              {trailerOpen && content.trailerUrl ? (
                <TrailerPlayer url={content.trailerUrl} title={content.title} />
              ) : (
                <>
                  {content.backdropUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={content.backdropUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div
                      className="h-full w-full"
                      style={{
                        background:
                          "radial-gradient(120% 120% at 70% 10%, #1e2a4d 0%, #131b31 50%, #0a0e17 100%)",
                      }}
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/30 to-transparent" />

                  {/* Title block over the backdrop */}
                  <div className="absolute inset-x-0 bottom-0 flex items-end gap-5 p-5 sm:p-7">
                    {content.posterUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={content.posterUrl}
                        alt=""
                        className="hidden w-28 shrink-0 rounded-lg border border-line-strong shadow-pop sm:block"
                      />
                    ) : null}
                    <div className="min-w-0">
                      <h2 className="display text-3xl font-bold leading-none text-foreground drop-shadow-lg sm:text-4xl">
                        {content.title}
                      </h2>
                      {content.originalTitle ? (
                        <p className="mt-1 truncate text-sm font-medium text-foreground/60">
                          {content.originalTitle}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="px-5 pb-7 sm:px-7">
              {/* Meta row */}
              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                {content.releaseYear ? (
                  <span className="font-bold text-foreground">
                    {content.releaseYear}
                  </span>
                ) : null}
                <Badge>{isSeries ? "Цуврал" : "Кино"}</Badge>
                {content.ageRating ? (
                  <span className="rounded border border-line-strong px-1.5 py-0.5 text-xs text-foreground/80">
                    {content.ageRating}
                  </span>
                ) : null}
                {!isSeries && content.durationSec ? (
                  <span className="text-muted">
                    {formatDuration(content.durationSec)}
                  </span>
                ) : null}
                {isSeries ? (
                  <span className="text-muted">
                    {content.seasons.length} улирал • {episodeCount} анги
                  </span>
                ) : null}
                <Badge tone={content.releaseStatus === "RELEASING" ? "teal" : "default"}>
                  {content.releaseStatus === "RELEASING"
                    ? "Одоо гарч байгаа"
                    : "Гарч дууссан"}
                </Badge>
                {content.ratingCount > 0 ? (
                  <span className="font-semibold text-gold">
                    ★ {content.ratingAvg?.toFixed(1)}{" "}
                    <span className="font-normal text-muted">
                      ({content.ratingCount})
                    </span>
                  </span>
                ) : null}
              </div>

              {/* Genres */}
              {content.genres.length > 0 ? (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {content.genres.map((g) => (
                    <Link
                      key={g.genre.id}
                      href={`/browse?genre=${g.genre.slug}`}
                      onClick={onClose}
                      className="rounded-md bg-white/[.07] px-2 py-0.5 text-xs font-medium text-foreground/80 transition hover:bg-white/[.14]"
                    >
                      {g.genre.name}
                    </Link>
                  ))}
                </div>
              ) : null}

              {/* Rental state */}
              {access?.viaRental && access.rentalEndsAt ? (
                <div className="mt-4 flex items-center gap-2 rounded-lg border border-gold/30 bg-gold/10 px-3.5 py-2.5 text-sm text-gold">
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
              <div className="mt-5 flex flex-wrap items-center gap-2.5">
                {canWatch ? (
                  <ButtonLink href={watchHref} variant="primary" size="lg">
                    <IconPlay size={18} />
                    {resume ? "Үргэлжлүүлэх" : "Үзэх"}
                  </ButtonLink>
                ) : null}
                {resume && canWatch ? (
                  <span className="text-xs text-muted">
                    {formatTimestamp(resume.progressSec)} хүртэл үзсэн
                  </span>
                ) : null}

                {content.trailerUrl ? (
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => setTrailerOpen((v) => !v)}
                    aria-pressed={trailerOpen}
                  >
                    {trailerOpen ? "Трейлер хаах" : "Трейлер"}
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

              {/* Description + facts */}
              <div className="mt-6 grid gap-6 md:grid-cols-[1fr_260px]">
                <div>
                  {content.description ? (
                    <p className="text-sm leading-relaxed text-foreground/85 sm:text-base">
                      {content.description}
                    </p>
                  ) : null}
                </div>
                <dl className="space-y-2.5 text-sm">
                  {content.director ? (
                    <Fact label="Найруулагч" value={content.director} />
                  ) : null}
                  {content.cast.length > 0 ? (
                    <Fact label="Гол дүрд" value={content.cast.join(", ")} />
                  ) : null}
                  {content.language ? (
                    <Fact label="Хэл" value={content.language} />
                  ) : null}
                  {content.subtitles.length > 0 ? (
                    <Fact
                      label="Хадмал"
                      value={content.subtitles
                        .map((s) => s.label ?? s.language)
                        .join(", ")}
                    />
                  ) : null}
                  {content.country ? (
                    <Fact label="Улс" value={content.country} />
                  ) : null}
                </dl>
              </div>

              {/* Episodes */}
              {isSeries && content.seasons.length > 0 ? (
                <EpisodeList
                  content={content}
                  history={history}
                  canWatch={Boolean(canWatch)}
                />
              ) : null}

              {/* Related */}
              {related.length > 0 ? (
                <section className="mt-8">
                  <h3 className="display text-lg font-semibold text-foreground">
                    Төстэй контент
                  </h3>
                  <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                    {related.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => openDetails(item.slug)}
                        className="group text-left"
                        aria-label={`${item.title} — дэлгэрэнгүй`}
                      >
                        <div className="aspect-[2/3] overflow-hidden rounded-lg border border-line bg-surface-raised">
                          {item.posterUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.posterUrl}
                              alt=""
                              loading="lazy"
                              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.05]"
                            />
                          ) : null}
                        </div>
                        <p className="mt-1.5 truncate text-xs font-semibold text-foreground/85">
                          {item.title}
                        </p>
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}

              {/* Full page escape hatch */}
              <div className="mt-7 border-t border-line pt-4">
                <Link
                  href={`/title/${content.slug}`}
                  onClick={onClose}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent transition hover:text-accent-hover"
                >
                  <IconInfo size={16} />
                  Дэлгэрэнгүй хуудас руу очих
                </Link>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Rental payment */}
      {rentCheckout && content ? (
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
    </>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wider text-muted">
        {label}
      </dt>
      <dd className="mt-0.5 text-foreground/85">{value}</dd>
    </div>
  );
}

/** Season tabs + episode rows with per-episode progress. */
function EpisodeList({
  content,
  history,
  canWatch,
}: {
  content: ContentDetail;
  history: HistoryItem[];
  canWatch: boolean;
}) {
  const [seasonIndex, setSeasonIndex] = useState(0);
  const season = content.seasons[seasonIndex];

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="display text-lg font-semibold text-foreground">Ангиуд</h3>
        {content.seasons.length > 1 ? (
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Улирал">
            {content.seasons.map((s, i) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={i === seasonIndex}
                onClick={() => setSeasonIndex(i)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  i === seasonIndex
                    ? "bg-foreground text-background"
                    : "bg-white/[.07] text-muted hover:bg-white/[.14] hover:text-foreground"
                }`}
              >
                {s.title ?? `Улирал ${s.number}`}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-3 space-y-1.5">
        {season?.episodes.map((ep) => {
          const row = history.find((h) => h.episode?.id === ep.id);
          const percent = row
            ? watchedPercent(row.progressSec, ep.durationSec)
            : null;
          const inner = (
            <>
              <span className="w-7 shrink-0 text-center text-base font-bold text-muted/70">
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
                    <div className="h-full bg-accent" style={{ width: `${percent}%` }} />
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
            </>
          );

          return canWatch ? (
            <Link
              key={ep.id}
              href={`/watch/${content.id}?episodeId=${ep.id}`}
              className="flex items-center gap-4 rounded-xl border border-line bg-surface-raised/50 px-3.5 py-2.5 transition hover:bg-surface-raised"
            >
              {inner}
            </Link>
          ) : (
            <div
              key={ep.id}
              className="flex items-center gap-4 rounded-xl border border-line bg-surface-raised/30 px-3.5 py-2.5 opacity-70"
            >
              {inner}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Trailer loads only after the user asks for it. */
function TrailerPlayer({ url, title }: { url: string; title: string }) {
  const isYouTube = /youtube\.com|youtu\.be/.test(url);
  if (isYouTube) {
    const id =
      url.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/)?.[1] ?? null;
    if (id) {
      return (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
          title={`${title} — трейлер`}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          className="h-full w-full"
        />
      );
    }
  }
  return <video src={url} controls autoPlay className="h-full w-full bg-black" />;
}

function DetailsSkeleton() {
  return (
    <div>
      <Skeleton className="aspect-video max-h-[46vh] w-full rounded-none" />
      <div className="px-5 pb-8 sm:px-7">
        <Skeleton className="mt-5 h-8 w-64 max-w-full" />
        <div className="mt-3 flex gap-2">
          <Skeleton className="h-5 w-14" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-24" />
        </div>
        <div className="mt-5 flex gap-2.5">
          <Skeleton className="h-12 w-36" />
          <Skeleton className="h-12 w-32" />
        </div>
        <div className="mt-6 space-y-2">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-4/5" />
          <Skeleton className="h-3.5 w-3/5" />
        </div>
      </div>
    </div>
  );
}
