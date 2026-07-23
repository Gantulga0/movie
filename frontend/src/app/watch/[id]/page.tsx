"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { API_URL, ApiError, activityApi, contentApi } from "@/lib/api";
import type { ContentDetail, WatchSources } from "@/lib/types";
import { ButtonLink, Button } from "@/components/ui/Button";
import { VideoPlayer, type PlayerEpisode } from "@/components/VideoPlayer";

const PROGRESS_INTERVAL_MS = 10_000;
/** Playback counts as "completed" past this share of the runtime. */
const COMPLETED_RATIO = 0.95;

function Player() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const episodeId = params.get("episodeId") ?? undefined;
  const startOver = params.get("startOver") === "1";
  const { user, token, loading: authLoading } = useAuth();

  const [sources, setSources] = useState<WatchSources | null>(null);
  const [detail, setDetail] = useState<ContentDetail | null>(null);
  const [detailLoaded, setDetailLoaded] = useState(false);
  const [error, setError] = useState<"subscription" | "rental" | "generic" | null>(
    null,
  );
  const [resumeAt, setResumeAt] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastSaved = useRef(0);

  // Content detail (seasons/episodes) powers the in-player episode list and the
  // series redirect. No video URLs here — those come per-episode from `watch`.
  useEffect(() => {
    if (!id) return;
    contentApi
      .get(id)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setDetailLoaded(true));
  }, [id]);

  // Flattened, ordered episode list for a series.
  const episodes = useMemo<PlayerEpisode[]>(() => {
    if (!detail) return [];
    return detail.seasons.flatMap((s) =>
      s.episodes.map((ep) => ({
        id: ep.id,
        number: ep.number,
        title: ep.title,
        seasonNumber: s.number,
        durationSec: ep.durationSec,
        thumbnailUrl: ep.thumbnailUrl,
      })),
    );
  }, [detail]);

  // A series opened without an episode (e.g. the featured "Watch" button) has no
  // content-level video → jump to the first episode instead of dead-ending.
  const willRedirect =
    !episodeId && detail?.type === "SERIES" && episodes.length > 0;
  useEffect(() => {
    if (willRedirect) {
      router.replace(`/watch/${id}?episodeId=${episodes[0].id}`);
    }
  }, [willRedirect, id, episodes, router]);

  const selectEpisode = useCallback(
    (epId: string) => router.push(`/watch/${id}?episodeId=${epId}`),
    [id, router],
  );

  // Signed URL for an arbitrary episode, for mid-frame thumbnail capture.
  const resolveEpisodeSource = useCallback(
    async (epId: string): Promise<string | null> => {
      if (!token) return null;
      try {
        const ws = await contentApi.watch(id, token, epId);
        return ws.videoAssets.find((a) => a.url)?.url ?? null;
      } catch {
        return null;
      }
    },
    [id, token],
  );

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
        } else if (err instanceof ApiError && err.code === "RENTAL_REQUIRED") {
          setError("rental");
        } else {
          setError("generic");
        }
      });
  }, [token, id, episodeId]);

  // Resume point from watch history (unless the user chose "start over").
  useEffect(() => {
    if (!token || !id || startOver) {
      queueMicrotask(() => setResumeAt(startOver ? 0 : null));
      return;
    }
    activityApi
      .history(token)
      .then((rows) => {
        const row = rows.find(
          (h) =>
            h.content.id === id &&
            (episodeId ? h.episode?.id === episodeId : !h.episode) &&
            !h.completed &&
            h.progressSec > 30,
        );
        setResumeAt(row ? row.progressSec : 0);
      })
      .catch(() => setResumeAt(0));
  }, [token, id, episodeId, startOver]);

  const saveProgress = useCallback(
    (completedOverride?: boolean) => {
      const video = videoRef.current;
      if (!video || !token || !sources) return;
      const progressSec = Math.floor(video.currentTime);
      if (progressSec < 1) return;
      lastSaved.current = progressSec;
      const completed =
        completedOverride ??
        (video.duration > 0 && progressSec / video.duration > COMPLETED_RATIO);
      activityApi
        .saveProgress(token, {
          contentId: sources.contentId,
          episodeId: sources.episodeId ?? undefined,
          progressSec,
          completed,
        })
        .catch(() => undefined);
    },
    [token, sources],
  );

  // Heartbeat save while playing.
  useEffect(() => {
    if (!token || !sources) return;
    const timer = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.paused) return;
      const progressSec = Math.floor(video.currentTime);
      if (progressSec === lastSaved.current) return;
      saveProgress();
    }, PROGRESS_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [token, sources, saveProgress]);

  // Save on tab hide / page unload — keepalive survives navigation.
  useEffect(() => {
    if (!token || !sources) return;
    function flush() {
      const video = videoRef.current;
      if (!video) return;
      const progressSec = Math.floor(video.currentTime);
      if (progressSec < 1) return;
      fetch(`${API_URL}/me/history`, {
        method: "PUT",
        keepalive: true,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          contentId: sources!.contentId,
          episodeId: sources!.episodeId ?? undefined,
          progressSec,
        }),
      }).catch(() => undefined);
    }
    function onVisibility() {
      if (document.visibilityState === "hidden") flush();
    }
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
      // Component unmount (player closes in-app) — one last save.
      flush();
    };
  }, [token, sources]);

  if (authLoading || !user) return null;

  // Redirecting a series to its first episode — show a spinner, not "no video".
  if (willRedirect) {
    return (
      <Shell>
        <div
          aria-label="Ачаалж байна"
          className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-accent"
        />
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
            Энэ киног үзэхийн тулд эрхийн багц идэвхжүүлнэ үү.
          </p>
          <ButtonLink href="/plans" variant="accent" size="lg" className="mt-6">
            Багц харах
          </ButtonLink>
        </div>
      </Shell>
    );
  }

  if (error === "rental") {
    return (
      <Shell>
        <div className="max-w-md text-center">
          <p className="display text-2xl font-semibold text-foreground">
            Түрээс шаардлагатай
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Энэ контент зөвхөн түрээсээр үзэгдэнэ. Дэлгэрэнгүй хуудаснаас нь
            түрээслээрэй.
          </p>
          <Button
            variant="accent"
            size="lg"
            className="mt-6"
            onClick={() => router.back()}
          >
            Буцах
          </Button>
        </div>
      </Shell>
    );
  }

  if (error === "generic") {
    return (
      <Shell>
        <div className="text-center">
          <p className="text-muted">Тоглуулахад алдаа гарлаа.</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => router.back()}
          >
            Буцах
          </Button>
        </div>
      </Shell>
    );
  }

  if (!sources || resumeAt === null) {
    return (
      <Shell>
        <div
          aria-label="Ачаалж байна"
          className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-accent"
        />
      </Shell>
    );
  }

  const playable = sources.videoAssets.filter((a) => a.url);

  if (playable.length === 0) {
    // Might be a series awaiting its first-episode redirect, or the detail is
    // still loading — show a spinner instead of flashing "no video" first.
    if (!detailLoaded || willRedirect) {
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
      <Shell>
        <div className="max-w-md text-center">
          <p className="text-muted">
            Энэ контентын видео файл хараахан ороогүй байна.
          </p>
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

  return (
    <VideoPlayer
      videoRef={videoRef}
      resumeAt={resumeAt}
      episodes={episodes.length ? episodes : undefined}
      currentEpisodeId={episodeId}
      onSelectEpisode={selectEpisode}
      resolveEpisodeSource={resolveEpisodeSource}
      posterFallback={detail?.backdropUrl ?? detail?.posterUrl ?? null}
      onBack={() => router.push("/home")}
      onPause={() => saveProgress()}
      onEnded={() => saveProgress(true)}
      sources={playable.map((a) => ({
        id: a.id,
        url: a.url!,
        label: a.quality === "P4K" ? "4K" : `${a.quality.replace("P", "")}p`,
      }))}
      subtitles={sources.subtitles
        .filter((s) => s.url)
        .map((s) => ({
          id: s.id,
          url: s.url!,
          language: s.language,
          label: s.label ?? s.language,
        }))}
    />
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
