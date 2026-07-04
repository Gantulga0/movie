"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { ContentCard, CardSkeleton } from "@/components/ContentCard";
import { useAuth } from "@/lib/auth-context";
import { contentApi } from "@/lib/api";
import type { Content, Genre } from "@/lib/types";
import { formatDuration } from "@/lib/format";

function HomeContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, loading: authLoading } = useAuth();

  const type = params.get("type") as "MOVIE" | "SERIES" | null;
  const genre = params.get("genre");

  const [items, setItems] = useState<Content[]>([]);
  const [featured, setFeatured] = useState<Content[]>([]);
  const [featuredLoading, setFeaturedLoading] = useState(true);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [heroIndex, setHeroIndex] = useState(0);

  // Guard: unauthenticated visitors are sent to login.
  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    contentApi.genres().then(setGenres).catch(() => setGenres([]));
    contentApi
      .list({ featured: true, limit: 6 })
      .then((res) => setFeatured(res.items))
      .catch(() => setFeatured([]))
      .finally(() => setFeaturedLoading(false));
  }, [user]);

  // Search is debounced so typing doesn't spam the API. The skeleton only
  // appears once the debounce fires, keeping old results visible meanwhile.
  useEffect(() => {
    if (!user) return;
    const id = setTimeout(() => {
      setLoading(true);
      contentApi
        .list({
          type: type ?? undefined,
          genre: genre ?? undefined,
          search: search || undefined,
          limit: 48,
        })
        .then((res) => setItems(res.items))
        .catch(() => setItems([]))
        .finally(() => setLoading(false));
    }, search ? 350 : 0);
    return () => clearTimeout(id);
  }, [user, type, genre, search]);

  // Featured hero auto-advances.
  useEffect(() => {
    if (featured.length < 2) return;
    const id = setInterval(
      () => setHeroIndex((i) => (i + 1) % featured.length),
      7000,
    );
    return () => clearInterval(id);
  }, [featured.length]);

  const hero = featured[heroIndex];
  const showHero = !search && !genre && !type;

  const filterHref = useMemo(() => {
    return (next: { type?: string | null; genre?: string | null }) => {
      const search = new URLSearchParams();
      const t = next.type === undefined ? type : next.type;
      const g = next.genre === undefined ? genre : next.genre;
      if (t) search.set("type", t);
      if (g) search.set("genre", g);
      const out = search.toString();
      return out ? `/home?${out}` : "/home";
    };
  }, [type, genre]);

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-brand" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Featured hero — skeleton while the featured list loads */}
      {showHero && featuredLoading ? (
        <section className="relative isolate flex min-h-[62vh] items-end overflow-hidden">
          <div className="absolute inset-0 -z-10 animate-pulse bg-white/[.04]" />
          <div className="max-w-2xl px-5 pb-14 sm:px-10">
            <div className="h-10 w-80 max-w-full animate-pulse rounded-lg bg-white/10 sm:h-14" />
            <div className="mt-4 flex gap-2">
              <div className="h-5 w-14 animate-pulse rounded bg-white/10" />
              <div className="h-5 w-20 animate-pulse rounded bg-white/10" />
              <div className="h-5 w-16 animate-pulse rounded bg-white/10" />
            </div>
            <div className="mt-5 space-y-2">
              <div className="h-3.5 w-[34rem] max-w-full animate-pulse rounded bg-white/8" />
              <div className="h-3.5 w-[28rem] max-w-full animate-pulse rounded bg-white/8" />
            </div>
            <div className="mt-7 flex gap-3">
              <div className="h-12 w-32 animate-pulse rounded-md bg-white/10" />
              <div className="h-12 w-36 animate-pulse rounded-md bg-white/8" />
            </div>
          </div>
        </section>
      ) : null}

      {/* Featured hero */}
      {showHero && !featuredLoading && hero ? (
        <section className="relative isolate flex min-h-[62vh] items-end overflow-hidden">
          <div className="absolute inset-0 -z-10">
            {hero.backdropUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={hero.id}
                src={hero.backdropUrl}
                alt=""
                className="animate-fade h-full w-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            ) : (
              <div
                className="h-full w-full"
                style={{
                  background:
                    "radial-gradient(120% 120% at 75% 15%, #3b1d6e 0%, #131033 45%, #050509 100%)",
                }}
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/50 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
          </div>

          <div key={hero.id} className="animate-rise max-w-2xl px-5 pb-14 sm:px-10">
            <h1 className="display text-4xl font-bold text-white drop-shadow-lg sm:text-6xl">
              {hero.title}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-white/70">
              {hero.releaseYear ? (
                <span className="font-semibold text-white">{hero.releaseYear}</span>
              ) : null}
              {hero.genres.slice(0, 3).map((g) => (
                <span
                  key={g.genre.id}
                  className="rounded bg-white/10 px-2 py-0.5 text-xs font-medium text-white/80"
                >
                  {g.genre.name}
                </span>
              ))}
              {hero.durationSec ? <span>{formatDuration(hero.durationSec)}</span> : null}
            </div>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/80 sm:text-base">
              {hero.description}
            </p>
            <div className="mt-6 flex gap-3">
              <Link
                href={`/title/${hero.slug}`}
                className="rounded-md bg-brand px-6 py-3 text-base font-bold text-white shadow-xl shadow-brand/30 transition hover:bg-brand-hover"
              >
                ▶ Үзэх
              </Link>
              <Link
                href={`/title/${hero.slug}`}
                className="rounded-md border border-white/25 bg-white/10 px-6 py-3 text-base font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
              >
                Дэлгэрэнгүй
              </Link>
            </div>
          </div>

          {featured.length > 1 ? (
            <div className="absolute bottom-6 right-6 flex gap-1.5">
              {featured.map((f, i) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setHeroIndex(i)}
                  aria-label={`${i + 1}-р онцлох`}
                  className={`h-1.5 rounded-full transition-all ${
                    i === heroIndex ? "w-7 bg-brand" : "w-3.5 bg-white/40"
                  }`}
                />
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Filters */}
      <section className="px-5 pt-8 sm:px-10">
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip href={filterHref({ type: null })} active={!type}>
            Бүгд
          </FilterChip>
          <FilterChip href={filterHref({ type: "MOVIE" })} active={type === "MOVIE"}>
            Кино
          </FilterChip>
          <FilterChip href={filterHref({ type: "SERIES" })} active={type === "SERIES"}>
            Цуврал
          </FilterChip>

          <span className="mx-1 h-5 w-px bg-white/15" aria-hidden />

          <FilterChip href={filterHref({ genre: null })} active={!genre}>
            Бүх төрөл
          </FilterChip>
          {genres.map((g) => (
            <FilterChip
              key={g.id}
              href={filterHref({ genre: g.slug })}
              active={genre === g.slug}
            >
              {g.name}
            </FilterChip>
          ))}

          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Хайх…"
            aria-label="Кино хайх"
            className="ml-auto w-full max-w-[220px] rounded-md border border-white/15 bg-white/5 px-3.5 py-2 text-sm text-white placeholder-white/40 outline-none transition focus:border-brand sm:w-auto"
          />
        </div>
      </section>

      {/* Grid */}
      <section className="px-5 py-8 sm:px-10">
        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-white/60">Илэрц олдсонгүй.</p>
            {search || genre || type ? (
              <Link
                href="/home"
                className="mt-3 inline-block text-sm font-semibold text-brand hover:text-brand-hover"
              >
                Бүх контентыг харах
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {items.map((content) => (
              <ContentCard key={content.id} content={content} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
        active
          ? "bg-white text-black"
          : "bg-white/8 text-white/70 hover:bg-white/15 hover:text-white"
      }`}
    >
      {children}
    </Link>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <HomeContent />
    </Suspense>
  );
}
