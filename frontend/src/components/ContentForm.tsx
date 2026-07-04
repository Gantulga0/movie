"use client";

import { FormEvent, useEffect, useState } from "react";
import { contentApi } from "@/lib/api";
import type { ContentDetail, Genre } from "@/lib/types";

export interface ContentFormValues {
  title: string;
  type: "MOVIE" | "SERIES";
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  description: string;
  releaseYear: string;
  durationMin: string;
  ageRating: string;
  language: string;
  country: string;
  cast: string;
  featured: boolean;
  genres: string[];
}

export function toPayload(values: ContentFormValues) {
  return {
    title: values.title.trim(),
    type: values.type,
    status: values.status,
    description: values.description.trim() || undefined,
    releaseYear: values.releaseYear ? Number(values.releaseYear) : undefined,
    durationSec: values.durationMin
      ? Number(values.durationMin) * 60
      : undefined,
    ageRating: values.ageRating.trim() || undefined,
    language: values.language.trim() || undefined,
    country: values.country.trim() || undefined,
    cast: values.cast
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    featured: values.featured,
    genres: values.genres,
  };
}

export function fromContent(content: ContentDetail): ContentFormValues {
  return {
    title: content.title,
    type: content.type,
    status: content.status,
    description: content.description ?? "",
    releaseYear: content.releaseYear ? String(content.releaseYear) : "",
    durationMin: content.durationSec
      ? String(Math.round(content.durationSec / 60))
      : "",
    ageRating: content.ageRating ?? "",
    language: content.language ?? "",
    country: content.country ?? "",
    cast: content.cast.join(", "),
    featured: content.featured,
    genres: content.genres.map((g) => g.genre.name),
  };
}

export const EMPTY_FORM: ContentFormValues = {
  title: "",
  type: "MOVIE",
  status: "DRAFT",
  description: "",
  releaseYear: "",
  durationMin: "",
  ageRating: "",
  language: "",
  country: "",
  cast: "",
  featured: false,
  genres: [],
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
    contentApi.genres().then(setAllGenres).catch(() => setAllGenres([]));
  }, []);

  function set<K extends keyof ContentFormValues>(key: K, value: ContentFormValues[K]) {
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
        <div className="mb-5 rounded-lg border border-brand/40 bg-brand/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
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
          <label htmlFor="cf-type" className={label}>
            Төрөл
          </label>
          <select
            id="cf-type"
            className={input}
            value={values.type}
            onChange={(e) => set("type", e.target.value as "MOVIE" | "SERIES")}
          >
            <option value="MOVIE">Кино</option>
            <option value="SERIES">Цуврал</option>
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

        {/* Genres */}
        <div className="sm:col-span-2">
          <p className={label}>Жанр</p>
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
            className="h-4 w-4 accent-[#e50914]"
          />
          <span className="text-sm text-white/80">
            Онцлох — нүүр хуудасны hero хэсэгт гаргах
          </span>
        </label>
      </div>

      <button
        type="submit"
        disabled={submitting || !values.title.trim()}
        className="mt-7 rounded-lg bg-brand px-7 py-3 text-base font-bold text-white transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Хадгалж байна…" : submitLabel}
      </button>
    </form>
  );
}
