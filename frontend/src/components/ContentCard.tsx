"use client";

import type { Content, ContentCardData } from "@/lib/types";
import { contentApi } from "@/lib/api";
import { formatDuration, formatMnt } from "@/lib/format";
import { useDetails } from "@/components/details/DetailsModalProvider";
import { useSubscription } from "@/lib/subscription-context";

type CardData = Content | ContentCardData;

interface ContentCardProps {
  content: CardData;
  /** 0–100; shows the progress strip on partially-watched titles. */
  progressPercent?: number | null;
}

/**
 * Poster card. Resting state is just the poster and the title; hovering
 * (or keyboard focus) reveals the details overlay inside the poster.
 * Clicking opens the cinematic details modal — never a hard navigation.
 */
export function ContentCard({ content, progressPercent }: ContentCardProps) {
  const { openDetails } = useDetails();
  const { hasActiveSub, loading: subLoading } = useSubscription();

  const full = "genres" in content ? content : null;
  const genreNames = full
    ? full.genres.map((g) => g.genre.name).slice(0, 3)
    : [];

  // Rental price tag: shown on rentable titles, except when the viewer's
  // plan already covers this title. Rental-only titles keep their tag even
  // for subscribers — they still pay per view. Waits for the subscription
  // check so subscribers never see the tag flash on refresh.
  const rentalPrice =
    content.isRentable && content.rentalPrice != null
      ? content.rentalPrice
      : null;
  const coveredByPlan = hasActiveSub && content.subscriptionIncluded !== false;
  const showPrice = !subLoading && rentalPrice != null && !coveredByPlan;

  const metaLine = [
    content.releaseYear,
    content.type === "SERIES" ? "Цуврал" : formatDuration(content.durationSec),
  ]
    .filter(Boolean)
    .join(" • ");

  return (
    <button
      type="button"
      onClick={() => openDetails(content.slug)}
      // Warm the catalog cache while the pointer hovers — the details
      // modal then opens with its data already in hand.
      onMouseEnter={() => contentApi.get(content.slug).catch(() => undefined)}
      onFocus={() => contentApi.get(content.slug).catch(() => undefined)}
      className="group block w-full text-left"
      aria-label={`${content.title} — дэлгэрэнгүй`}
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-line bg-surface shadow-card transition duration-200 group-hover:-translate-y-1 group-hover:border-line-strong group-focus-visible:-translate-y-1">
        {content.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={content.posterUrl}
            alt={content.title}
            loading="lazy"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <div
            className="flex h-full w-full items-end p-3"
            style={{
              background:
                "linear-gradient(160deg, #1e2a4d 0%, #131b31 55%, #0a0e17 100%)",
            }}
          >
            <span className="display text-base font-semibold leading-snug text-foreground/90">
              {content.title}
            </span>
          </div>
        )}

        {/* Hover reveal: details rise from the bottom of the poster */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-background-deep/95 via-background-deep/40 to-transparent p-3 opacity-0 transition duration-200 group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          <div className="translate-y-2 transition duration-200 group-hover:translate-y-0 group-focus-visible:translate-y-0">
            {metaLine ? (
              <p className="text-xs font-semibold text-foreground/90">
                {metaLine}
              </p>
            ) : null}
            {genreNames.length > 0 ? (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {genreNames.map((name) => (
                  <span
                    key={name}
                    className="rounded-md bg-white/[.14] px-1.5 py-0.5 text-[10px] font-medium text-foreground/85 backdrop-blur-sm"
                  >
                    {name}
                  </span>
                ))}
              </div>
            ) : null}
            {full?.description ? (
              <p className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-foreground/70">
                {full.description}
              </p>
            ) : null}
          </div>
        </div>

        {/* Top-left: format marker */}
        {content.type === "SERIES" ? (
          <span className="absolute left-2 top-2 rounded-md bg-background-deep/75 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-foreground/90 backdrop-blur-sm">
            Цуврал
          </span>
        ) : null}

        {/* Top-right: rental price tag (hidden for covered subscribers) */}
        {showPrice ? (
          <span className="absolute right-2 top-2 inline-flex items-center rounded-md bg-background-deep/85 px-2 py-1 text-[11px] font-bold tabular-nums text-gold shadow-[0_2px_10px_rgba(3,6,18,0.5)] ring-1 ring-gold/35 backdrop-blur-md">
            {formatMnt(rentalPrice)}
          </span>
        ) : null}

        {/* Watch-progress strip */}
        {progressPercent != null && progressPercent > 0 ? (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-background-deep/70">
            <div
              className="h-full bg-accent"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        ) : null}
      </div>

      <p className="mt-2 truncate text-sm font-semibold text-foreground">
        {content.title}
      </p>
    </button>
  );
}

export { CardSkeleton } from "@/components/ui/Skeleton";
