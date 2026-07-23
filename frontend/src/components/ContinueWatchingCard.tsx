"use client";

import { useRouter } from "next/navigation";
import type { HistoryItem } from "@/lib/types";
import {
  formatTimestamp,
  formatDuration,
  watchedPercent,
} from "@/lib/format";
import {
  IconCheckCircle,
  IconPlay,
  IconRotateCcw,
  IconX,
} from "@/components/ui/icons";

interface ContinueWatchingCardProps {
  item: HistoryItem;
  onRemove: (contentId: string) => void;
}

/**
 * Continue Watching entry: thumbnail with a live progress strip, position,
 * remaining time, and resume / start-over / remove controls.
 */
export function ContinueWatchingCard({ item, onRemove }: ContinueWatchingCardProps) {
  const router = useRouter();
  const { content, episode } = item;

  const duration = episode?.durationSec ?? content.durationSec;
  const percent = watchedPercent(item.progressSec, duration);
  const remainingSec =
    duration && duration > item.progressSec ? duration - item.progressSec : null;

  const resumeHref = episode
    ? `/watch/${content.id}?episodeId=${episode.id}`
    : `/watch/${content.id}`;
  const startOverHref = `${resumeHref}${episode ? "&" : "?"}startOver=1`;

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={() => router.push(resumeHref)}
        className="block w-full text-left"
        aria-label={`${content.title} — үргэлжлүүлж үзэх`}
      >
        <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-line bg-surface shadow-card transition duration-200 group-hover:-translate-y-1 group-hover:border-line-strong">
          {content.posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={content.posterUrl}
              alt={content.title}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <div
              className="h-full w-full"
              style={{
                background:
                  "linear-gradient(160deg, #1e2a4d 0%, #131b31 55%, #0a0e17 100%)",
              }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background-deep/85 via-transparent to-transparent" />

          {/* Watched badge */}
          {item.completed ? (
            <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-background-deep/80 px-2 py-0.5 text-[10px] font-bold text-accent backdrop-blur-sm">
              <IconCheckCircle size={12} /> Үзсэн
            </span>
          ) : null}

          {/* Center play affordance */}
          <span className="absolute inset-0 grid place-items-center opacity-0 transition group-hover:opacity-100">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-foreground/90 text-background shadow-pop">
              <IconPlay size={22} />
            </span>
          </span>

          {/* Position + progress */}
          <div className="absolute inset-x-0 bottom-0 px-3 pb-2">
            <div className="flex items-end justify-between gap-2 text-[11px] font-semibold text-foreground/90">
              <span>
                {item.completed
                  ? "Үзэж дууссан"
                  : `${formatTimestamp(item.progressSec)} хүртэл үзсэн`}
              </span>
              {!item.completed && remainingSec ? (
                <span className="text-foreground/60">
                  {formatDuration(remainingSec)} үлдсэн
                </span>
              ) : null}
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${percent ?? 4}%` }}
              />
            </div>
          </div>
        </div>

        <div className="mt-2 min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {content.title}
          </p>
          {episode ? (
            <p className="truncate text-xs text-muted">
              Улирал {episode.season.number} • Анги {episode.number}
            </p>
          ) : null}
        </div>
      </button>

      {/* Hover controls */}
      <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
        <button
          type="button"
          onClick={() => router.push(startOverHref)}
          aria-label={`${content.title} — эхнээс нь үзэх`}
          title="Эхнээс нь"
          className="grid h-8 w-8 place-items-center rounded-full bg-background-deep/85 text-foreground/80 backdrop-blur-sm transition hover:bg-surface-raised hover:text-foreground"
        >
          <IconRotateCcw size={15} />
        </button>
        <button
          type="button"
          onClick={() => onRemove(content.id)}
          aria-label={`${content.title} — жагсаалтаас хасах`}
          title="Хасах"
          className="grid h-8 w-8 place-items-center rounded-full bg-background-deep/85 text-foreground/80 backdrop-blur-sm transition hover:bg-danger/80 hover:text-white"
        >
          <IconX size={15} />
        </button>
      </div>
    </div>
  );
}
