"use client";

import type { Content, ContentCardData } from "@/lib/types";
import { formatDuration } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { useDetails } from "@/components/details/DetailsModalProvider";

type CardData = Content | ContentCardData;

interface ContentCardProps {
  content: CardData;
  /** 0–100; shows the progress strip on partially-watched titles. */
  progressPercent?: number | null;
}

/**
 * Poster card. Clicking opens the cinematic details modal — never a hard
 * navigation. Hover lifts gently; no layout shift.
 */
export function ContentCard({ content, progressPercent }: ContentCardProps) {
  const { openDetails } = useDetails();

  const full = "genres" in content ? content : null;
  const genres = full
    ? full.genres.map((g) => g.genre.name).slice(0, 2).join(" · ")
    : null;
  const rentalOnly = full ? full.isRentable && !full.subscriptionIncluded : false;

  return (
    <button
      type="button"
      onClick={() => openDetails(content.slug)}
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

        {/* Top-edge badges */}
        <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
          {content.type === "SERIES" ? (
            <span className="rounded-md bg-background-deep/75 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-foreground/90 backdrop-blur-sm">
              Цуврал
            </span>
          ) : null}
          {rentalOnly ? (
            <span className="rounded-md bg-gold/90 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-background-deep">
              Түрээс
            </span>
          ) : null}
        </div>

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

      <div className="mt-2">
        <p className="truncate text-sm font-semibold text-foreground">
          {content.title}
        </p>
        <p className="truncate text-xs text-muted">
          {[content.releaseYear, genres ?? formatDuration(content.durationSec)]
            .filter(Boolean)
            .join(" • ")}
        </p>
      </div>
    </button>
  );
}

export { CardSkeleton } from "@/components/ui/Skeleton";

/** Rental price chip shown on browse cards when relevant. */
export function RentalChip({ price }: { price: number }) {
  return <Badge tone="gold">{price.toLocaleString("en-US")}₮</Badge>;
}
