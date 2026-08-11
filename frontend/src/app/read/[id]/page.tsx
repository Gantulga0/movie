"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ApiError, activityApi, contentApi } from "@/lib/api";
import type { ChapterDetail, ContentAccess, ContentDetail } from "@/lib/types";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import {
  IconArrowLeft,
  IconChevronLeft,
  IconChevronRight,
} from "@/components/ui/icons";

function Reader() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const chapterId = params.get("chapterId") ?? undefined;
  const { user, token, loading: authLoading } = useAuth();

  const [detail, setDetail] = useState<ContentDetail | null>(null);
  const [access, setAccess] = useState<ContentAccess | null>(null);
  const [chapter, setChapter] = useState<ChapterDetail | null>(null);
  const [error, setError] = useState<"subscription" | "generic" | null>(null);
  const completedSent = useRef<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  // Chapter list + title; bodies come per-chapter from the read endpoint.
  useEffect(() => {
    if (!id) return;
    contentApi
      .get(id)
      .then(setDetail)
      .catch(() => setError("generic"));
  }, [id]);

  useEffect(() => {
    if (!id || !token) return;
    contentApi
      .access(id, token)
      .then(setAccess)
      .catch(() => setAccess(null));
  }, [id, token]);

  // Opened without a chapter — resume from history, else start at chapter 1.
  const needsResume = !chapterId && Boolean(detail);
  useEffect(() => {
    if (!needsResume || !detail || !token) return;
    if (detail.chapters.length === 0) return;
    let cancelled = false;
    activityApi
      .history(token)
      .then((rows) => {
        if (cancelled) return;
        const row = rows.find((h) => h.content.id === detail.id && h.chapter);
        let target = detail.chapters[0].id;
        if (row?.chapter) {
          const idx = detail.chapters.findIndex((c) => c.id === row.chapter!.id);
          if (idx >= 0) {
            target =
              row.completed && idx < detail.chapters.length - 1
                ? detail.chapters[idx + 1].id
                : detail.chapters[idx].id;
          }
        }
        router.replace(`/read/${detail.id}?chapterId=${target}`);
      })
      .catch(() => {
        if (!cancelled) {
          router.replace(`/read/${detail.id}?chapterId=${detail.chapters[0].id}`);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [needsResume, detail, token, router]);

  // The chapter body (entitlement enforced server-side).
  useEffect(() => {
    if (!id || !chapterId || !token) return;
    setChapter(null);
    setError(null);
    contentApi
      .chapter(id, chapterId, token)
      .then(setChapter)
      .catch((err) => {
        if (err instanceof ApiError && err.code === "SUBSCRIPTION_REQUIRED") {
          setError("subscription");
        } else {
          setError("generic");
        }
      });
  }, [id, chapterId, token]);

  // Opening a chapter marks it as the reading position.
  useEffect(() => {
    if (!token || !chapter) return;
    activityApi
      .saveProgress(token, {
        contentId: chapter.contentId,
        chapterId: chapter.id,
        progressSec: 0,
      })
      .catch(() => undefined);
  }, [token, chapter]);

  // Reaching the end of the text marks the chapter completed (once).
  useEffect(() => {
    if (!token || !chapter || !endRef.current) return;
    const chapterKey = chapter.id;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        if (completedSent.current === chapterKey) return;
        completedSent.current = chapterKey;
        activityApi
          .saveProgress(token, {
            contentId: chapter.contentId,
            chapterId: chapter.id,
            progressSec: 0,
            completed: true,
          })
          .catch(() => undefined);
      },
      { rootMargin: "0px 0px 80px 0px" },
    );
    observer.observe(endRef.current);
    return () => observer.disconnect();
  }, [token, chapter]);

  const paragraphs = useMemo(
    () =>
      chapter
        ? chapter.body
            .split(/\r?\n\s*\n/)
            .map((p) => p.trim())
            .filter(Boolean)
        : [],
    [chapter],
  );

  const chapterOptions = useMemo(() => {
    if (!detail) return [];
    const unlocked = access?.canWatch ?? false;
    return detail.chapters.map((c) => ({
      value: c.id,
      label: `${c.number}. ${c.title}${
        !unlocked && c.number > detail.freeChapterCount ? " — 🔒" : ""
      }`,
    }));
  }, [detail, access]);

  if (authLoading || !user) return null;

  if (detail && detail.chapters.length === 0) {
    return (
      <Shell>
        <div className="max-w-md text-center">
          <p className="text-muted">Энэ бичвэрт бүлэг хараахан ороогүй байна.</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => router.push("/home")}
          >
            Буцах
          </Button>
        </div>
      </Shell>
    );
  }

  if (error === "subscription") {
    return (
      <Shell>
        <div className="max-w-md text-center">
          <p className="display text-2xl font-semibold text-foreground">
            Эрхийн багц шаардлагатай
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            {detail && detail.freeChapterCount > 0
              ? `Эхний ${detail.freeChapterCount} бүлэг үнэгүй. Үргэлжлүүлэн уншихын тулд эрхийн багц идэвхжүүлнэ үү.`
              : "Энэ бүлгийг уншихын тулд эрхийн багц идэвхжүүлнэ үү."}
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <ButtonLink href="/plans" variant="accent" size="lg">
              Багц харах
            </ButtonLink>
            <Button variant="outline" size="lg" onClick={() => router.back()}>
              Буцах
            </Button>
          </div>
        </div>
      </Shell>
    );
  }

  if (error === "generic") {
    return (
      <Shell>
        <div className="text-center">
          <p className="text-muted">Бүлэг ачаалахад алдаа гарлаа.</p>
          <Button variant="outline" className="mt-4" onClick={() => router.back()}>
            Буцах
          </Button>
        </div>
      </Shell>
    );
  }

  if (!chapter) {
    return (
      <Shell>
        <div
          aria-label="Ачаалж байна"
          className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-accent"
        />
      </Shell>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-line bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-5 py-3">
          <button
            type="button"
            onClick={() => router.push("/home")}
            aria-label="Буцах"
            className="shrink-0 rounded-lg p-2 text-muted transition hover:bg-white/[.07] hover:text-foreground"
          >
            <IconArrowLeft size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <Link
              href={`/title/${chapter.content.slug}`}
              className="block truncate text-sm font-bold text-foreground hover:text-accent"
            >
              {chapter.content.title}
            </Link>
            <p className="truncate text-xs text-muted">
              Бүлэг {chapter.number} — {chapter.title}
            </p>
          </div>
        </div>
      </header>

      {/* Body */}
      <main className="mx-auto max-w-2xl px-5 pb-24 pt-10">
        <h1 className="display text-2xl font-semibold text-foreground sm:text-3xl">
          Бүлэг {chapter.number}
        </h1>
        <p className="mt-1 text-base text-muted">{chapter.title}</p>

        <article className="mt-8 space-y-5">
          {paragraphs.map((p, i) => (
            <p
              key={i}
              className="text-base leading-relaxed text-foreground/90 sm:text-lg sm:leading-loose"
            >
              {p}
            </p>
          ))}
        </article>
        <div ref={endRef} aria-hidden className="h-px" />

        {/* Chapter navigation */}
        <nav className="mt-12 border-t border-line pt-6">
          {chapterOptions.length > 1 ? (
            <Select
              label="Бүлэг сонгох"
              value={chapter.id}
              onChange={(next) => router.push(`/read/${id}?chapterId=${next}`)}
              options={chapterOptions}
              searchable={chapterOptions.length > 12}
              className="mb-5 max-w-xs"
            />
          ) : null}
          <div className="flex items-center justify-between gap-3">
            {chapter.prevId ? (
              <ButtonLink
                href={`/read/${id}?chapterId=${chapter.prevId}`}
                variant="outline"
              >
                <IconChevronLeft size={16} />
                Өмнөх бүлэг
              </ButtonLink>
            ) : (
              <span />
            )}
            {chapter.nextId ? (
              <ButtonLink
                href={`/read/${id}?chapterId=${chapter.nextId}`}
                variant="accent"
              >
                Дараагийн бүлэг
                <IconChevronRight size={16} />
              </ButtonLink>
            ) : (
              <span className="text-sm text-muted">Төгсгөл</span>
            )}
          </div>
        </nav>
      </main>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5">
      {children}
    </div>
  );
}

export default function ReadPage() {
  return (
    <Suspense fallback={null}>
      <Reader />
    </Suspense>
  );
}
