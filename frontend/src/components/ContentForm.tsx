"use client";

import { FormEvent, useEffect, useState } from "react";
import { contentApi } from "@/lib/api";
import type { ContentDetail, Genre } from "@/lib/types";

export interface ContentFormValues {
  title: string;
  originalTitle: string;
  type: "MOVIE" | "SERIES" | "NOVEL";
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  releaseStatus: "RELEASING" | "COMPLETED";
  description: string;
  releaseYear: string;
  durationMin: string;
  ageRating: string;
  language: string;
  country: string;
  director: string;
  cast: string;
  featured: boolean;
  genres: string[];
  // Novel settings
  freeChapterCount: string;
  // Rental settings
  isRentable: boolean;
  rentalPrice: string;
  rentalDurationHours: string;
  subscriptionIncluded: boolean;
}

export function toPayload(values: ContentFormValues) {
  const isNovel = values.type === "NOVEL";
  return {
    title: values.title.trim(),
    originalTitle: values.originalTitle.trim() || undefined,
    type: values.type,
    status: values.status,
    releaseStatus: values.releaseStatus,
    description: values.description.trim() || undefined,
    releaseYear: values.releaseYear ? Number(values.releaseYear) : undefined,
    durationSec:
      !isNovel && values.durationMin
        ? Number(values.durationMin) * 60
        : undefined,
    ageRating: values.ageRating.trim() || undefined,
    language: values.language.trim() || undefined,
    country: values.country.trim() || undefined,
    director: isNovel ? undefined : values.director.trim() || undefined,
    cast: isNovel
      ? []
      : values.cast
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
    featured: values.featured,
    genres: values.genres,
    freeChapterCount: isNovel
      ? Number(values.freeChapterCount) || 0
      : undefined,
    // Novels are never rentable — the paywall is subscription-only.
    isRentable: isNovel ? false : values.isRentable,
    rentalPrice:
      !isNovel && values.rentalPrice ? Number(values.rentalPrice) : undefined,
    rentalDurationHours:
      !isNovel && values.rentalDurationHours
        ? Number(values.rentalDurationHours)
        : undefined,
    subscriptionIncluded: values.subscriptionIncluded,
  };
}

export function fromContent(content: ContentDetail): ContentFormValues {
  return {
    title: content.title,
    originalTitle: content.originalTitle ?? "",
    type: content.type,
    status: content.status,
    releaseStatus: content.releaseStatus,
    description: content.description ?? "",
    releaseYear: content.releaseYear ? String(content.releaseYear) : "",
    durationMin: content.durationSec
      ? String(Math.round(content.durationSec / 60))
      : "",
    ageRating: content.ageRating ?? "",
    language: content.language ?? "",
    country: content.country ?? "",
    director: content.director ?? "",
    cast: content.cast.join(", "),
    featured: content.featured,
    genres: content.genres.map((g) => g.genre.name),
    freeChapterCount: String(content.freeChapterCount ?? 0),
    isRentable: content.isRentable,
    rentalPrice: content.rentalPrice ? String(content.rentalPrice) : "",
    rentalDurationHours: String(content.rentalDurationHours ?? 48),
    subscriptionIncluded: content.subscriptionIncluded,
  };
}

export const EMPTY_FORM: ContentFormValues = {
  title: "",
  originalTitle: "",
  type: "MOVIE",
  status: "DRAFT",
  releaseStatus: "COMPLETED",
  description: "",
  releaseYear: "",
  durationMin: "",
  ageRating: "",
  language: "",
  country: "",
  director: "",
  cast: "",
  featured: false,
  genres: [],
  freeChapterCount: "0",
  isRentable: false,
  rentalPrice: "",
  rentalDurationHours: "48",
  subscriptionIncluded: true,
};

interface ContentFormProps {
  initial: ContentFormValues;
  submitLabel: string;
  submitting: boolean;
  error?: string;
  onSubmit: (values: ContentFormValues) => void;
}

export function ContentForm({
  initial,
  submitLabel,
  submitting,
  error,
  onSubmit,
}: ContentFormProps) {
  const [values, setValues] = useState<ContentFormValues>(initial);
  const [allGenres, setAllGenres] = useState<Genre[]>([]);

  useEffect(() => {
    contentApi
      .genres(values.type)
      .then(setAllGenres)
      .catch(() => setAllGenres([]));
  }, [values.type]);

  function set<K extends keyof ContentFormValues>(
    key: K,
    value: ContentFormValues[K],
  ) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function toggleGenre(name: string) {
    setValues((v) => ({
      ...v,
      genres: v.genres.includes(name)
        ? v.genres.filter((g) => g !== name)
        : [...v.genres, name],
    }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit(values);
  }

  const input =
    "w-full rounded-lg border border-white/15 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder-white/35 outline-none transition focus:border-brand";
  const label = "mb-1.5 block text-sm font-medium text-white/80";

  return (
    <form onSubmit={handleSubmit} noValidate className="max-w-3xl">
      {error ? (
        <div className="mb-5 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="cf-title" className={label}>
            Гарчиг *
          </label>
          <input
            id="cf-title"
            className={input}
            value={values.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Киноны нэр"
            required
          />
        </div>

        <div>
          <label htmlFor="cf-original-title" className={label}>
            Эх гарчиг
          </label>
          <input
            id="cf-original-title"
            className={input}
            value={values.originalTitle}
            onChange={(e) => set("originalTitle", e.target.value)}
            placeholder="Original title"
          />
        </div>

        <div>
          <label htmlFor="cf-type" className={label}>
            Төрөл
          </label>
          <select
            id="cf-type"
            className={input}
            value={values.type}
            onChange={(e) =>
              set("type", e.target.value as ContentFormValues["type"])
            }
          >
            <option value="MOVIE">Кино</option>
            <option value="SERIES">Цуврал</option>
            <option value="NOVEL">Бичвэр</option>
          </select>
        </div>

        <div>
          <label htmlFor="cf-status" className={label}>
            Төлөв
          </label>
          <select
            id="cf-status"
            className={input}
            value={values.status}
            onChange={(e) =>
              set("status", e.target.value as ContentFormValues["status"])
            }
          >
            <option value="DRAFT">Ноорог</option>
            <option value="PUBLISHED">Нийтлэх</option>
            <option value="ARCHIVED">Архивлах</option>
          </select>
        </div>

        <div>
          <label htmlFor="cf-release-status" className={label}>
            Гаралтын төлөв
          </label>
          <select
            id="cf-release-status"
            className={input}
            value={values.releaseStatus}
            onChange={(e) =>
              set(
                "releaseStatus",
                e.target.value as ContentFormValues["releaseStatus"],
              )
            }
          >
            <option value="RELEASING">Одоо гарч байгаа</option>
            <option value="COMPLETED">Гарч дууссан</option>
          </select>
        </div>

        {values.type !== "NOVEL" ? (
          <div>
            <label htmlFor="cf-director" className={label}>
              Найруулагч
            </label>
            <input
              id="cf-director"
              className={input}
              value={values.director}
              onChange={(e) => set("director", e.target.value)}
              placeholder="Chad Stahelski"
            />
          </div>
        ) : null}

        <div className="sm:col-span-2">
          <label htmlFor="cf-desc" className={label}>
            Тайлбар
          </label>
          <textarea
            id="cf-desc"
            className={`${input} min-h-28 resize-y`}
            value={values.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Киноны товч агуулга…"
          />
        </div>

        <div>
          <label htmlFor="cf-year" className={label}>
            Он
          </label>
          <input
            id="cf-year"
            type="number"
            className={input}
            value={values.releaseYear}
            onChange={(e) => set("releaseYear", e.target.value)}
            placeholder="2024"
          />
        </div>

        {values.type !== "NOVEL" ? (
          <div>
            <label htmlFor="cf-duration" className={label}>
              Үргэлжлэх (минут)
            </label>
            <input
              id="cf-duration"
              type="number"
              className={input}
              value={values.durationMin}
              onChange={(e) => set("durationMin", e.target.value)}
              placeholder="120"
            />
          </div>
        ) : (
          <div>
            <label htmlFor="cf-free-chapters" className={label}>
              Үнэгүй бүлгийн тоо
            </label>
            <input
              id="cf-free-chapters"
              type="number"
              min={0}
              className={input}
              value={values.freeChapterCount}
              onChange={(e) => set("freeChapterCount", e.target.value)}
              placeholder="2"
            />
            <p className="mt-1 text-xs text-white/45">
              Эхний хэдэн бүлэг эрхгүй хэрэглэгчид үнэгүй уншигдахыг заана.
            </p>
          </div>
        )}

        <div>
          <label htmlFor="cf-age" className={label}>
            Насны ангилал
          </label>
          <input
            id="cf-age"
            className={input}
            value={values.ageRating}
            onChange={(e) => set("ageRating", e.target.value)}
            placeholder="PG-13"
          />
        </div>

        <div>
          <label htmlFor="cf-lang" className={label}>
            Хэл
          </label>
          <input
            id="cf-lang"
            className={input}
            value={values.language}
            onChange={(e) => set("language", e.target.value)}
            placeholder="en, mn…"
          />
        </div>

        {values.type !== "NOVEL" ? (
          <div className="sm:col-span-2">
            <label htmlFor="cf-cast" className={label}>
              Гол дүрд (таслалаар тусгаарлана)
            </label>
            <input
              id="cf-cast"
              className={input}
              value={values.cast}
              onChange={(e) => set("cast", e.target.value)}
              placeholder="Keanu Reeves, Donnie Yen"
            />
          </div>
        ) : null}

        {/* Genres */}
        <div className="sm:col-span-2">
          <p className={label}>Ангилал</p>
          <div className="flex flex-wrap gap-2">
            {allGenres.map((g) => {
              const on = values.genres.includes(g.name);
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => toggleGenre(g.name)}
                  aria-pressed={on}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    on
                      ? "bg-brand text-white"
                      : "bg-white/8 text-white/60 hover:bg-white/15"
                  }`}
                >
                  {g.name}
                </button>
              );
            })}
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-2.5 sm:col-span-2">
          <input
            type="checkbox"
            checked={values.featured}
            onChange={(e) => set("featured", e.target.checked)}
            className="h-4 w-4 accent-(--accent)"
          />
          <span className="text-sm text-white/80">
            Онцлох — нүүр хуудасны hero хэсэгт гаргах
          </span>
        </label>

        {/* Rental settings */}
        <fieldset className="rounded-xl border border-line bg-white/[.03] p-4 sm:col-span-2">
          <legend className="px-1 text-sm font-bold text-white/85">
            Хандалт ба түрээс
          </legend>

          <label className="flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              checked={values.subscriptionIncluded}
              onChange={(e) => set("subscriptionIncluded", e.target.checked)}
              className="h-4 w-4 accent-(--accent)"
            />
            <span className="text-sm text-white/80">
              Багцад багтана — эрхийн багцтай хэрэглэгчид үзнэ
            </span>
          </label>

          {values.type !== "NOVEL" ? (
            <label className="mt-3 flex cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                checked={values.isRentable}
                onChange={(e) => set("isRentable", e.target.checked)}
                className="h-4 w-4 accent-(--accent)"
              />
              <span className="text-sm text-white/80">
                Түрээслэх боломжтой — нэг удаагийн төлбөрөөр үзнэ
              </span>
            </label>
          ) : (
            <p className="mt-3 text-xs text-white/45">
              Бичвэр контент түрээслэгдэхгүй
            </p>
          )}

          {values.type !== "NOVEL" && values.isRentable ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="cf-rental-price" className={label}>
                  Түрээсийн үнэ (₮) *
                </label>
                <input
                  id="cf-rental-price"
                  type="number"
                  min={100}
                  className={input}
                  value={values.rentalPrice}
                  onChange={(e) => set("rentalPrice", e.target.value)}
                  placeholder="5000"
                  required
                />
              </div>
              <div>
                <label htmlFor="cf-rental-duration" className={label}>
                  Түрээсийн хугацаа (цаг)
                </label>
                <input
                  id="cf-rental-duration"
                  type="number"
                  min={1}
                  max={720}
                  className={input}
                  value={values.rentalDurationHours}
                  onChange={(e) => set("rentalDurationHours", e.target.value)}
                  placeholder="48"
                />
              </div>
            </div>
          ) : null}

          {!values.subscriptionIncluded &&
          (values.type === "NOVEL" || !values.isRentable) ? (
            <p className="mt-3 text-xs text-gold">
              Анхаар: багцад ч багтахгүй, түрээслэгдэхгүй бол энэ контентыг хэн
              ч үзэж чадахгүй (түр хаагдсан төлөв).
            </p>
          ) : null}
        </fieldset>
      </div>

      <button
        type="submit"
        disabled={
          submitting ||
          !values.title.trim() ||
          (values.type !== "NOVEL" && values.isRentable && !values.rentalPrice)
        }
        className="mt-7 rounded-lg bg-brand px-7 py-3 text-base font-bold text-white transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Хадгалж байна…" : submitLabel}
      </button>
    </form>
  );
}
