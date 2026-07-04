"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/lib/auth-context";
import { contentApi } from "@/lib/api";
import type { Content } from "@/lib/types";

interface Slide {
  tag: string;
  title: string;
  year: string;
  genres: string[];
  description: string;
  image: string | null;
}

const BASE_GRADIENT =
  "radial-gradient(120% 120% at 75% 20%, #1d1030 0%, #0e0c1d 45%, #050509 100%)";

/** Featured content (curated in the admin panel) becomes a hero slide. */
function toSlide(content: Content): Slide {
  return {
    tag: content.type === "SERIES" ? "ЦУВРАЛ" : "ОНЦЛОХ",
    title: content.title,
    year: content.releaseYear ? String(content.releaseYear) : "",
    genres: content.genres.slice(0, 3).map((g) => g.genre.name),
    description: content.description ?? "",
    image: content.backdropUrl ?? content.posterUrl,
  };
}

const SLIDE_INTERVAL = 6500;

export default function LandingPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [active, setActive] = useState(0);
  // null = still loading; [] = nothing featured yet.
  const [slides, setSlides] = useState<Slide[] | null>(null);

  // Logged-in visitors go straight to the movie home page.
  useEffect(() => {
    if (!loading && user) {
      router.replace("/home");
    }
  }, [loading, user, router]);

  // The hero is fully admin-curated: content flagged "featured".
  useEffect(() => {
    contentApi
      .list({ featured: true, limit: 6 })
      .then((res) => setSlides(res.items.map(toSlide)))
      .catch(() => setSlides([]));
  }, []);

  // Auto-advancing carousel.
  useEffect(() => {
    if (!slides || slides.length < 2) return;
    const id = setInterval(
      () => setActive((i) => (i + 1) % slides.length),
      SLIDE_INTERVAL,
    );
    return () => clearInterval(id);
  }, [slides]);

  const slide = slides?.[active] ?? null;

  return (
    // `isolate` keeps the -z-10 background above ancestor backgrounds.
    <main className="relative isolate min-h-screen w-full overflow-hidden bg-background">
      {/* Background carousel */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0" style={{ background: BASE_GRADIENT }} />
        {slides?.map((s, i) => (
          <div
            key={s.title}
            className={`absolute inset-0 transition-opacity duration-1000 ease-out ${
              i === active ? "opacity-100" : "opacity-0"
            }`}
            aria-hidden={i !== active}
          >
            {s.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={s.image}
                alt=""
                className={`absolute inset-0 h-full w-full object-cover ${
                  i === active ? "animate-kenburns" : ""
                }`}
                // A missing file falls back to the gradient instead of a
                // broken-image icon.
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            ) : null}
          </div>
        ))}
        {/* Readability overlays */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/55 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/20" />
      </div>

      {/* Header */}
      <header className="relative z-20 flex items-center justify-between px-5 py-5 sm:px-10 sm:py-6">
        <Logo />
        <nav className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/login"
            className="rounded-md px-3 py-2 text-sm font-semibold text-white/90 transition hover:text-white sm:px-4"
          >
            Нэвтрэх
          </Link>
          <Link
            href="/register"
            className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-brand/25 transition hover:bg-brand-hover sm:px-5"
          >
            Бүртгүүлэх
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative z-10 flex min-h-[calc(100vh-88px)] items-center px-5 sm:px-10">
        {slides === null ? (
          /* Loading skeleton — no stale placeholder titles */
          <div className="max-w-2xl">
            <div className="h-6 w-24 animate-pulse rounded-full bg-white/10" />
            <div className="mt-6 h-14 w-[28rem] max-w-full animate-pulse rounded-lg bg-white/10 sm:h-20" />
            <div className="mt-5 flex gap-2">
              <div className="h-5 w-14 animate-pulse rounded bg-white/10" />
              <div className="h-5 w-20 animate-pulse rounded bg-white/10" />
            </div>
            <div className="mt-6 space-y-2.5">
              <div className="h-4 w-[32rem] max-w-full animate-pulse rounded bg-white/8" />
              <div className="h-4 w-[26rem] max-w-full animate-pulse rounded bg-white/8" />
            </div>
            <div className="mt-9 flex gap-3">
              <div className="h-13 w-36 animate-pulse rounded-md bg-white/10" />
              <div className="h-13 w-32 animate-pulse rounded-md bg-white/8" />
            </div>
          </div>
        ) : slide ? (
          /* Featured movie slide */
          <div key={slide.title} className="max-w-2xl animate-rise">
            <span className="inline-block rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs font-semibold tracking-[0.2em] text-white/80 backdrop-blur-sm">
              {slide.tag}
            </span>

            <h1 className="display mt-5 text-4xl font-bold leading-tight tracking-tight text-white drop-shadow-xl sm:text-6xl lg:text-7xl">
              {slide.title}
            </h1>

            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-white/70">
              {slide.year ? (
                <>
                  <span className="font-semibold text-white">{slide.year}</span>
                  <span className="text-white/40">•</span>
                </>
              ) : null}
              {slide.genres.map((g) => (
                <span
                  key={g}
                  className="rounded bg-white/10 px-2 py-0.5 text-xs font-medium text-white/80"
                >
                  {g}
                </span>
              ))}
            </div>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-white/80 sm:text-lg">
              {slide.description}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/register"
                className="rounded-md bg-brand px-7 py-3.5 text-base font-bold text-white shadow-xl shadow-brand/30 transition hover:bg-brand-hover"
              >
                Одоо эхлэх
              </Link>
              <Link
                href="/login"
                className="rounded-md border border-white/25 bg-white/10 px-7 py-3.5 text-base font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
              >
                Нэвтрэх
              </Link>
            </div>
          </div>
        ) : (
          /* Nothing featured yet — generic pitch */
          <div className="max-w-2xl animate-rise">
            <h1 className="display text-4xl font-bold leading-tight tracking-tight text-white drop-shadow-xl sm:text-6xl lg:text-7xl">
              Хязгааргүй кино, цуврал, анимэ
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-white/80 sm:text-lg">
              Дуртай контентоо хаанаас ч, хэзээ ч тасралтгүй үзээрэй. Сарын
              8,000₮-өөс эхэлнэ.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/register"
                className="rounded-md bg-brand px-7 py-3.5 text-base font-bold text-white shadow-xl shadow-brand/30 transition hover:bg-brand-hover"
              >
                Одоо эхлэх
              </Link>
              <Link
                href="/login"
                className="rounded-md border border-white/25 bg-white/10 px-7 py-3.5 text-base font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
              >
                Нэвтрэх
              </Link>
            </div>
          </div>
        )}
      </section>

      {/* Carousel indicators */}
      {slides && slides.length > 1 ? (
        <div className="absolute bottom-8 left-5 z-20 flex items-center gap-2 sm:left-10">
          {slides.map((s, i) => (
            <button
              key={s.title}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`${i + 1}-р дүрс`}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === active
                  ? "w-8 bg-brand"
                  : "w-4 bg-white/40 hover:bg-white/70"
              }`}
            />
          ))}
        </div>
      ) : null}
    </main>
  );
}
