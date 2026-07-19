"use client";

import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { ContentCard } from "@/components/ContentCard";
import { ContentRow } from "@/components/ContentRow";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { IconSearch, IconX } from "@/components/ui/icons";
import { contentApi } from "@/lib/api";
import type { Content } from "@/lib/types";

const DEBOUNCE_MS = 350;
const RECENT_KEY = "mnflix_recent_searches";
const RECENT_LIMIT = 8;

function readRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? list.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export default function SearchPage() {
  return (
    <AppShell>
      <SearchContent />
    </AppShell>
  );
}

function SearchContent() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Content[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [trending, setTrending] = useState<Content[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // State updates land in a microtask so the effect body itself stays sync-free.
    queueMicrotask(() => setRecent(readRecent()));
    inputRef.current?.focus();
    // Suggestions while the box is empty: the most-watched titles.
    contentApi
      .list({ sort: "watched", limit: 12 })
      .then((res) => setTrending(res.items))
      .catch(() => setTrending([]));
  }, []);

  // Debounced search — matches localized and original titles server-side.
  useEffect(() => {
    const term = query.trim();
    if (!term) {
      queueMicrotask(() => {
        setResults(null);
        setLoading(false);
      });
      return;
    }
    queueMicrotask(() => setLoading(true));
    const id = setTimeout(() => {
      contentApi
        .list({ search: term, limit: 36 })
        .then((res) => {
          setResults(res.items);
          // A search that returned something is worth remembering.
          if (res.items.length > 0) {
            setRecent((prev) => {
              const next = [term, ...prev.filter((x) => x !== term)].slice(
                0,
                RECENT_LIMIT,
              );
              localStorage.setItem(RECENT_KEY, JSON.stringify(next));
              return next;
            });
          }
        })
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query]);

  function clearRecent() {
    localStorage.removeItem(RECENT_KEY);
    setRecent([]);
  }

  return (
    <div className="py-8">
      <div className="px-5 sm:px-10">
        <PageHeader eyebrow="Хайлт" title="Хайх" />

        {/* Search box */}
        <div className="relative mt-5 max-w-2xl">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted">
            <IconSearch size={20} />
          </span>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setQuery("");
            }}
            placeholder="Кино, цуврал, жанр, он…"
            aria-label="Кино хайх"
            className="no-focus-ring w-full rounded-2xl border border-line bg-surface-raised/80 py-3.5 pl-12 pr-12 text-base text-foreground placeholder-muted/70 outline-none transition focus:border-accent/40 focus:bg-surface-raised focus:shadow-[0_0_28px_rgba(124,140,255,0.15)]"
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              aria-label="Хайлт арилгах"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-muted transition hover:bg-white/10 hover:text-foreground"
            >
              <IconX size={16} />
            </button>
          ) : null}
        </div>

        {/* Recent searches */}
        {!query && recent.length > 0 ? (
          <div className="mt-5 max-w-2xl">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted">
                Сүүлийн хайлтууд
              </p>
              <button
                type="button"
                onClick={clearRecent}
                className="text-xs font-semibold text-muted transition hover:text-foreground"
              >
                Арилгах
              </button>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {recent.map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => setQuery(term)}
                  className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm text-foreground/80 transition hover:border-line-strong hover:text-foreground"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* Results / suggestions */}
      {query ? (
        <div className="mt-7 px-5 sm:px-10">
          {loading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : results && results.length === 0 ? (
            <EmptyState
              icon={<IconSearch size={40} />}
              title={`«${query.trim()}» олдсонгүй`}
              description="Өөр түлхүүр үгээр хайж үзээрэй — нэрийг нь монголоор ч, эх хэлээр нь ч хайж болно."
            />
          ) : results ? (
            <>
              <p className="mb-3 text-xs text-muted">{results.length} илэрц</p>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {results.map((content) => (
                  <ContentCard key={content.id} content={content} />
                ))}
              </div>
            </>
          ) : null}
        </div>
      ) : trending.length > 0 ? (
        <ContentRow title="Их үзэж байгаа" viewAllHref="/browse?sort=watched">
          {trending.map((content) => (
            <ContentCard key={content.id} content={content} />
          ))}
        </ContentRow>
      ) : null}
    </div>
  );
}
