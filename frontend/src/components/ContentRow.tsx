"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { IconChevronLeft, IconChevronRight } from "@/components/ui/icons";
import { CardSkeleton } from "@/components/ui/Skeleton";

interface ContentRowProps {
  title: string;
  viewAllHref?: string;
  loading?: boolean;
  /** How many skeleton cards to show while loading. */
  skeletonCount?: number;
  children: React.ReactNode;
  /** Wider cards (Continue Watching thumbnails). */
  wide?: boolean;
}

/**
 * Horizontal content rail: wheel/trackpad scrolling, snap points, and
 * keyboard-reachable prev/next paddles that appear when overflow exists.
 */
export function ContentRow({
  title,
  viewAllHref,
  loading = false,
  skeletonCount = 6,
  children,
  wide = false,
}: ContentRowProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const updatePaddles = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 8);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  }, []);

  useEffect(() => {
    updatePaddles();
    const el = scrollerRef.current;
    if (!el) return;
    el.addEventListener("scroll", updatePaddles, { passive: true });
    window.addEventListener("resize", updatePaddles);
    return () => {
      el.removeEventListener("scroll", updatePaddles);
      window.removeEventListener("resize", updatePaddles);
    };
  }, [updatePaddles, loading, children]);

  function scrollBy(direction: 1 | -1) {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.85, behavior: "smooth" });
  }

  const itemWidth = wide
    ? "w-[260px] sm:w-[300px]"
    : "w-[140px] sm:w-[165px] lg:w-[185px]";

  return (
    <section className="mt-9">
      <div className="mb-3 flex items-baseline justify-between px-5 sm:px-10">
        <h2 className="display text-lg font-semibold text-foreground sm:text-xl">
          {title}
        </h2>
        {viewAllHref ? (
          <Link
            href={viewAllHref}
            className="text-xs font-semibold text-accent transition hover:text-accent-hover"
          >
            Бүгдийг харах →
          </Link>
        ) : null}
      </div>

      <div className="group/row relative">
        <div
          ref={scrollerRef}
          className="no-scrollbar flex snap-x snap-mandatory gap-3.5 overflow-x-auto scroll-smooth px-5 pb-2 sm:px-10"
        >
          {loading
            ? Array.from({ length: skeletonCount }).map((_, i) => (
                <div key={i} className={`${itemWidth} shrink-0 snap-start`}>
                  <CardSkeleton />
                </div>
              ))
            : Array.isArray(children)
              ? children.map((child, i) => (
                  <div key={i} className={`${itemWidth} shrink-0 snap-start`}>
                    {child}
                  </div>
                ))
              : children}
        </div>

        {/* Paddles — desktop affordance; touch users just swipe. */}
        {canPrev ? (
          <RowPaddle side="left" onClick={() => scrollBy(-1)} />
        ) : null}
        {canNext ? <RowPaddle side="right" onClick={() => scrollBy(1)} /> : null}
      </div>
    </section>
  );
}

function RowPaddle({
  side,
  onClick,
}: {
  side: "left" | "right";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Өмнөх" : "Дараах"}
      className={`absolute top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-background-deep/85 text-foreground opacity-0 shadow-card backdrop-blur-sm transition hover:bg-surface-raised focus-visible:opacity-100 group-hover/row:opacity-100 md:flex ${
        side === "left" ? "left-3" : "right-3"
      }`}
    >
      {side === "left" ? <IconChevronLeft /> : <IconChevronRight />}
    </button>
  );
}
