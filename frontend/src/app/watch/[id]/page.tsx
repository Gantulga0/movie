"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { API_URL, ApiError, activityApi, contentApi } from "@/lib/api";
import type { WatchSources } from "@/lib/types";
import { ButtonLink, Button } from "@/components/ui/Button";
import { IconArrowLeft } from "@/components/ui/icons";

const PROGRESS_INTERVAL_MS = 10_000;
/** Playback counts as "completed" past this share of the runtime. */
const COMPLETED_RATIO = 0.95;
/** The watermark drifts to a new spot this often (anti-crop). */
const WATERMARK_MOVE_MS = 20_000;

function Player() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const episodeId = params.get("episodeId") ?? undefined;
  const startOver = params.get("startOver") === "1";
  const { user, token, loading: authLoading } = useAuth();

  const [sources, setSources] = useState<WatchSources | null>(null);
  const [error, setError] = useState<"subscription" | "rental" | "generic" | null>(
    null,
  );
  const [qualityIndex, setQualityIndex] = useState(0);
  const [resumeAt, setResumeAt] = useState<number | null>(null);
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
  const current = playable[qualityIndex];

  if (!current) {
    return (
      <Shell>
        <div className="max-w-md text-center">
          <p className="text-muted">
            Энэ контентын видео файл хараахан ороогүй байна.
          </p>
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

  return (
    <div className="flex min-h-screen flex-col bg-black">
      <header className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-foreground/80 transition hover:bg-white/10 hover:text-foreground"
        >
          <IconArrowLeft size={17} />
          Буцах
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
                aria-pressed={i === qualityIndex}
                className={`rounded-md px-2.5 py-1 text-xs font-bold transition ${
                  i === qualityIndex
                    ? "bg-foreground text-background"
                    : "bg-white/10 text-foreground/70 hover:bg-white/20"
                }`}
              >
                {asset.quality.replace("P", "")}p
              </button>
            ))}
          </div>
        ) : null}
      </header>

      <div className="relative flex flex-1 items-center justify-center">
        <video
          ref={videoRef}
          key={current.id}
          src={current.url!}
          controls
          autoPlay
          controlsList="nodownload"
          className="max-h-[calc(100vh-64px)] w-full"
          crossOrigin="anonymous"
          onLoadedMetadata={(e) => {
            // Resume from the saved position on first load.
            const video = e.currentTarget;
            if (resumeAt > 0 && Math.abs(video.currentTime - resumeAt) > 2) {
              video.currentTime = Math.min(
                resumeAt,
                Math.max(0, (video.duration || resumeAt) - 2),
              );
            }
          }}
          onPause={() => saveProgress()}
          onEnded={() => saveProgress(true)}
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

        <Watermark publicId={user.publicId} />
      </div>
    </div>
  );
}

/**
 * Session watermark: the viewer's public id + time, drifting across the
 * frame so cropping it out of a screen recording is impractical. This is a
 * deterrent, not DRM — see docs/SECURITY.md for the real boundary.
 */
function Watermark({ publicId }: { publicId: string }) {
  const [position, setPosition] = useState({ top: "8%", left: "6%" });
  const [stamp, setStamp] = useState("");

  useEffect(() => {
    function move() {
      setPosition({
        top: `${8 + Math.random() * 74}%`,
        left: `${6 + Math.random() * 74}%`,
      });
      const now = new Date();
      setStamp(
        `${String(now.getHours()).padStart(2, "0")}:${String(
          now.getMinutes(),
        ).padStart(2, "0")}`,
      );
    }
    move();
    const timer = setInterval(move, WATERMARK_MOVE_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute select-none text-[11px] font-semibold tracking-wider text-white/[.16] transition-[top,left] duration-1000"
      style={position}
    >
      USER-{publicId} • {stamp}
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
