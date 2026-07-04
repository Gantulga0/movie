"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ApiError, activityApi, contentApi } from "@/lib/api";
import type { WatchSources } from "@/lib/types";

const PROGRESS_INTERVAL_MS = 10_000;

function Player() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const episodeId = params.get("episodeId") ?? undefined;
  const { user, token, loading: authLoading } = useAuth();

  const [sources, setSources] = useState<WatchSources | null>(null);
  const [error, setError] = useState<"subscription" | "generic" | null>(null);
  const [qualityIndex, setQualityIndex] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastSaved = useRef(0);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!token || !id) return;
    contentApi
      .watch(id, token, episodeId)
      .then(setSources)
      .catch((err) => {
        if (err instanceof ApiError && err.code === "SUBSCRIPTION_REQUIRED") {
          setError("subscription");
        } else {
          setError("generic");
        }
      });
  }, [token, id, episodeId]);

  // Report playback progress every few seconds so history/continue works.
  useEffect(() => {
    if (!token || !sources) return;
    const timer = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.paused) return;
      const progressSec = Math.floor(video.currentTime);
      if (progressSec === lastSaved.current) return;
      lastSaved.current = progressSec;
      activityApi
        .saveProgress(token, {
          contentId: sources.contentId,
          episodeId: sources.episodeId ?? undefined,
          progressSec,
          completed: video.duration > 0 && progressSec / video.duration > 0.95,
        })
        .catch(() => undefined);
    }, PROGRESS_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [token, sources]);

  if (authLoading || !user) return null;

  if (error === "subscription") {
    return (
      <Shell>
        <div className="max-w-md text-center">
          <p className="display text-2xl font-semibold text-white">
            Эрхийн багц шаардлагатай
          </p>
          <p className="mt-3 text-sm leading-relaxed text-white/60">
            Энэ киног үзэхийн тулд эрхийн багц идэвхжүүлнэ үү. Багц 1 сарын
            8,000₮-өөс эхэлнэ.
          </p>
          <Link
            href="/plans"
            className="mt-6 inline-block rounded-md bg-brand px-7 py-3 text-base font-bold text-white transition hover:bg-brand-hover"
          >
            Багц харах
          </Link>
        </div>
      </Shell>
    );
  }

  if (error === "generic") {
    return (
      <Shell>
        <div className="text-center">
          <p className="text-white/60">Тоглуулахад алдаа гарлаа.</p>
          <button
            type="button"
            onClick={() => router.back()}
            className="mt-4 rounded-md border border-white/25 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
          >
            Буцах
          </button>
        </div>
      </Shell>
    );
  }

  if (!sources) {
    return (
      <Shell>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-brand" />
      </Shell>
    );
  }

  const playable = sources.videoAssets.filter((a) => a.url);
  const current = playable[qualityIndex];

  if (!current) {
    return (
      <Shell>
        <div className="max-w-md text-center">
          <p className="text-white/60">
            Энэ контентын видео файл хараахан ороогүй байна.
          </p>
          <button
            type="button"
            onClick={() => router.back()}
            className="mt-4 rounded-md border border-white/25 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
          >
            Буцах
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-black">
      <header className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded px-3 py-1.5 text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
        >
          ← Буцах
        </button>

        {playable.length > 1 ? (
          <div className="flex gap-1.5" role="group" aria-label="Чанар сонгох">
            {playable.map((asset, i) => (
              <button
                key={asset.id}
                type="button"
                onClick={() => {
                  const t = videoRef.current?.currentTime ?? 0;
                  setQualityIndex(i);
                  // Keep the position across a quality switch.
                  requestAnimationFrame(() => {
                    if (videoRef.current) videoRef.current.currentTime = t;
                  });
                }}
                className={`rounded px-2.5 py-1 text-xs font-bold transition ${
                  i === qualityIndex
                    ? "bg-white text-black"
                    : "bg-white/10 text-white/70 hover:bg-white/20"
                }`}
              >
                {asset.quality.replace("P", "")}p
              </button>
            ))}
          </div>
        ) : null}
      </header>

      <div className="flex flex-1 items-center justify-center">
        <video
          ref={videoRef}
          key={current.id}
          src={current.url!}
          controls
          autoPlay
          className="max-h-[calc(100vh-64px)] w-full"
          crossOrigin="anonymous"
        >
          {sources.subtitles
            .filter((s) => s.url)
            .map((s) => (
              <track
                key={s.id}
                kind="subtitles"
                src={s.url!}
                srcLang={s.language}
                label={s.label ?? s.language}
              />
            ))}
        </video>
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-5">
      {children}
    </div>
  );
}

export default function WatchPage() {
  return (
    <Suspense fallback={null}>
      <Player />
    </Suspense>
  );
}
