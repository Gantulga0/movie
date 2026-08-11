"use client";

import Link from "next/link";
import type { ContentDetail, HistoryItem } from "@/lib/types";
import { IconCheck } from "@/components/ui/icons";

/**
 * Novel chapter rows. The first `freeChapterCount` chapters are open for
 * everyone; the rest link only for entitled viewers and show a lock
 * otherwise. Completed chapters (from reading history) get a check mark.
 */
export function ChapterList({
  content,
  history,
  canWatch,
}: {
  content: ContentDetail;
  history: HistoryItem[];
  canWatch: boolean;
}) {
  return (
    <section className="mt-8">
      <h3 className="display text-lg font-semibold text-foreground">Бүлгүүд</h3>
      <div className="mt-3 space-y-1.5">
        {content.chapters.map((ch) => {
          const completed = history.some(
            (h) => h.chapter?.id === ch.id && h.completed,
          );
          const locked = !canWatch && ch.number > content.freeChapterCount;
          const inner = (
            <>
              <span className="w-7 shrink-0 text-center text-base font-bold text-muted/70">
                {ch.number}
              </span>
              <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                {ch.title}
              </p>
              {completed ? (
                <span className="shrink-0 text-accent" aria-label="Уншсан">
                  <IconCheck size={16} />
                </span>
              ) : null}
              {locked ? (
                <span className="shrink-0 text-xs text-muted" aria-label="Түгжээтэй">
                  🔒
                </span>
              ) : !canWatch ? (
                <span className="shrink-0 rounded bg-teal-500/15 px-1.5 py-0.5 text-[10px] font-bold text-teal-300">
                  Үнэгүй
                </span>
              ) : null}
            </>
          );

          return locked ? (
            <div
              key={ch.id}
              className="flex items-center gap-4 rounded-xl border border-line bg-surface-raised/30 px-3.5 py-2.5 opacity-70"
            >
              {inner}
            </div>
          ) : (
            <Link
              key={ch.id}
              href={`/read/${content.id}?chapterId=${ch.id}`}
              className="flex items-center gap-4 rounded-xl border border-line bg-surface-raised/50 px-3.5 py-2.5 transition hover:bg-surface-raised"
            >
              {inner}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
