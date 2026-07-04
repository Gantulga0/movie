import Link from "next/link";
import type { Content, ContentCardData } from "@/lib/types";
import { formatDuration } from "@/lib/format";

type CardData = Content | ContentCardData;

export function ContentCard({ content }: { content: CardData }) {
  const genres =
    "genres" in content
      ? content.genres.map((g) => g.genre.name).slice(0, 2).join(" · ")
      : null;

  return (
    <Link href={`/title/${content.slug}`} className="group block">
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg border border-line bg-surface">
        {content.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={content.posterUrl}
            alt={content.title}
            loading="lazy"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div
            className="flex h-full w-full items-end p-3"
            style={{
              background:
                "linear-gradient(160deg, #2a1147 0%, #12102b 55%, #0a0a12 100%)",
            }}
          >
            <span className="display text-base font-semibold leading-snug text-white/90">
              {content.title}
            </span>
          </div>
        )}

        {content.type === "SERIES" ? (
          <span className="absolute left-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/90">
            Цуврал
          </span>
        ) : null}
      </div>

      <div className="mt-2">
        <p className="truncate text-sm font-semibold text-white">{content.title}</p>
        <p className="truncate text-xs text-white/50">
          {[content.releaseYear, genres ?? formatDuration(content.durationSec)]
            .filter(Boolean)
            .join(" • ")}
        </p>
      </div>
    </Link>
  );
}

export function CardSkeleton() {
  return (
    <div>
      <div className="aspect-[2/3] animate-pulse rounded-lg bg-white/5" />
      <div className="mt-2 h-3.5 w-3/4 animate-pulse rounded bg-white/5" />
    </div>
  );
}
