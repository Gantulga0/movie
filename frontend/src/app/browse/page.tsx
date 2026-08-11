"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { ContentCard } from "@/components/ContentCard";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { IconCompass, IconX } from "@/components/ui/icons";
import { contentApi, type ContentListParams } from "@/lib/api";
import { typeLabel } from "@/lib/format";
import type {
  Content,
  ContentSort,
  ContentType,
  Genre,
  ReleaseStatus,
} from "@/lib/types";

const PAGE_SIZE = 24;
const CURRENT_YEAR = new Date().getFullYear();

const SORT_OPTIONS: Array<{ value: ContentSort; label: string }> = [
  { value: "new", label: "Шинээр нэмэгдсэн" },
  { value: "watched", label: "Их үзсэн" },
  { value: "rated", label: "Өндөр үнэлгээтэй" },
  { value: "year", label: "Гарсан он" },
  { value: "title", label: "Үсгийн дараалал" },
];

/** Exact years plus decade ranges, encoded into one select. */
const YEAR_OPTIONS: Array<{ value: string; label: string }> = [
  ...Array.from({ length: 12 }, (_, i) => {
    const y = CURRENT_YEAR - i;
    return { value: String(y), label: String(y) };
  }),
  { value: `r:${CURRENT_YEAR - 5}:${CURRENT_YEAR}`, label: `Сүүлийн 5 жил` },
  { value: "r:2010:2019", label: "2010—2019" },
  { value: "r:2000:2009", label: "2000—2009" },
  { value: "r:1980:1999", label: "1980—1999" },
];

export default function BrowsePage() {
  return (
    <AppShell>
      <Suspense fallback={null}>
        <BrowseContent />
      </Suspense>
    </AppShell>
  );
}

function BrowseContent() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const type = params.get("type");
  const genre = params.get("genre");
  const country = params.get("country");
  const year = params.get("year");
  const status = params.get("status");
  const sort = (params.get("sort") as ContentSort | null) ?? "new";

  const [genres, setGenres] = useState<Genre[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [items, setItems] = useState<Content[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    contentApi.genres().then(setGenres).catch(() => setGenres([]));
    contentApi.countries().then(setCountries).catch(() => setCountries([]));
  }, []);

  // URL params are the single source of truth for every filter.
  const query = useMemo((): ContentListParams => {
    const q: ContentListParams = { sort, limit: PAGE_SIZE };
    if (type === "MOVIE" || type === "SERIES" || type === "NOVEL") q.type = type;
    if (genre) q.genre = genre;
    if (country) q.country = country;
    if (status === "RELEASING" || status === "COMPLETED")
      q.releaseStatus = status as ReleaseStatus;
    if (year) {
      const range = year.match(/^r:(\d{4}):(\d{4})$/);
      if (range) {
        q.yearFrom = Number(range[1]);
        q.yearTo = Number(range[2]);
      } else if (/^\d{4}$/.test(year)) {
        q.year = Number(year);
      }
    }
    return q;
  }, [type, genre, country, year, status, sort]);

  // New filters → fresh first page.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setPage(1);
    contentApi
      .list({ ...query, page: 1 })
      .then((res) => {
        if (cancelled) return;
        setItems(res.items);
        setTotal(res.total);
      })
      .catch(() => {
        if (!cancelled) {
          setItems([]);
          setTotal(0);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const next = page + 1;
      const res = await contentApi.list({ ...query, page: next });
      setItems((prev) => [...prev, ...res.items]);
      setPage(next);
    } catch {
      // Leave the current page as-is; the button stays available.
    } finally {
      setLoadingMore(false);
    }
  }

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  const activeFilters: Array<{ key: string; label: string }> = [];
  if (type)
    activeFilters.push({
      key: "type",
      label: typeLabel(type as ContentType),
    });
  if (genre) {
    const g = genres.find((x) => x.slug === genre);
    activeFilters.push({ key: "genre", label: g?.name ?? genre });
  }
  if (country) activeFilters.push({ key: "country", label: country });
  if (year) {
    const y = YEAR_OPTIONS.find((o) => o.value === year);
    activeFilters.push({ key: "year", label: y?.label ?? year });
  }
  if (status)
    activeFilters.push({
      key: "status",
      label: status === "RELEASING" ? "Одоо гарч байгаа" : "Гарч дууссан",
    });

  return (
    <div className="px-5 py-8 sm:px-10">
      <PageHeader
        eyebrow={
          type === "MOVIE"
            ? "Бүх кино"
            : type === "SERIES"
              ? "Бүх цуврал"
              : type === "NOVEL"
                ? "Бүх бичвэр"
                : "Бүх контент"
        }
        title="Ангилал"
      />

      {/* Filters. Mobile-first: the type switch spans full width, the filter
          dropdowns sit in a tidy 2-up grid, and sort gets its own full-width
          row. From lg they relax into a single inline row. */}
      <div className="mt-7 flex flex-col gap-4">
        {/* Content type segmented control */}
        <div>
          <span className="mb-1.5 block text-[13px] font-bold text-foreground">
            Төрөл
          </span>
          <div
            className="flex rounded-xl border border-line bg-surface p-1 sm:inline-flex"
            role="group"
            aria-label="Контентын төрөл"
          >
            {[
              { value: null, label: "Бүгд" },
              { value: "MOVIE", label: "Кино" },
              { value: "SERIES", label: "Цуврал" },
              { value: "NOVEL", label: "Бичвэр" },
            ].map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => setParam("type", opt.value)}
                aria-pressed={type === opt.value || (!type && !opt.value)}
                className={`flex-1 rounded-lg px-3.5 py-2 text-sm font-semibold transition sm:flex-none ${
                  type === opt.value || (!type && !opt.value)
                    ? "bg-foreground text-background"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dropdown filters + sort */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end">
          <Select
            label="Ангилал"
            value={genre ?? ""}
            onChange={(v) => setParam("genre", v || null)}
            searchable
            searchPlaceholder="Ангилал хайх"
            options={[
              { value: "", label: "Бүх ангилал" },
              ...genres.map((g) => ({ value: g.slug, label: g.name })),
            ]}
            className="w-full lg:w-44"
          />

          {countries.length > 0 ? (
            <Select
              label="Улс"
              value={country ?? ""}
              onChange={(v) => setParam("country", v || null)}
              searchable
              searchPlaceholder="Улс хайх"
              options={[
                { value: "", label: "Бүх улс" },
                ...countries.map((c) => ({ value: c, label: c })),
              ]}
              className="w-full lg:w-44"
            />
          ) : null}

          <Select
            label="Он"
            value={year ?? ""}
            onChange={(v) => setParam("year", v || null)}
            options={[{ value: "", label: "Бүх он" }, ...YEAR_OPTIONS]}
            className="w-full lg:w-40"
          />

          <Select
            label="Төлөв"
            value={status ?? ""}
            onChange={(v) => setParam("status", v || null)}
            options={[
              { value: "", label: "Бүх төлөв" },
              { value: "RELEASING", label: "Одоо гарч байгаа" },
              { value: "COMPLETED", label: "Гарч дууссан" },
            ]}
            className="w-full lg:w-44"
          />

          <Select
            label="Эрэмбэ"
            value={sort}
            onChange={(v) => setParam("sort", v === "new" ? null : v)}
            options={SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            className="w-full sm:col-span-2 lg:col-span-1 lg:ml-auto lg:w-48"
          />
        </div>
      </div>

      {/* Active filters */}
      {activeFilters.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {activeFilters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setParam(f.key, null)}
              className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent transition hover:bg-accent/25"
            >
              {f.label}
              <IconX size={13} />
            </button>
          ))}
          <button
            type="button"
            onClick={() => router.replace(pathname, { scroll: false })}
            className="text-xs font-semibold text-muted transition hover:text-foreground"
          >
            Бүгдийг арилгах
          </button>
        </div>
      ) : null}

      {/* Results */}
      <div className="mt-6">
        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<IconCompass size={40} />}
            title="Илэрц олдсонгүй"
            description="Шүүлтүүрээ өөрчилж эсвэл арилгаад дахин үзээрэй."
            action={
              activeFilters.length > 0 ? (
                <Button
                  variant="outline"
                  onClick={() => router.replace(pathname, { scroll: false })}
                >
                  Шүүлтүүр арилгах
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <p className="mb-3 text-xs text-muted">{total} илэрц</p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {items.map((content) => (
                <ContentCard key={content.id} content={content} />
              ))}
            </div>
            {items.length < total ? (
              <div className="mt-8 flex justify-center">
                <Button
                  variant="outline"
                  size="lg"
                  loading={loadingMore}
                  onClick={loadMore}
                >
                  Цааш үзэх ({items.length}/{total})
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

