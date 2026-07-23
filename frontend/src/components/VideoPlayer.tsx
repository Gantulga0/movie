"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { IconArrowLeft } from "@/components/ui/icons";

export interface PlayerSource {
  id: string;
  url: string;
  /** Display label, e.g. "1080p" or "4K". */
  label: string;
}

export interface PlayerSubtitle {
  id: string;
  url: string;
  language: string;
  label: string;
}

export interface PlayerEpisode {
  id: string;
  number: number;
  title: string;
  seasonNumber: number;
  durationSec?: number | null;
  thumbnailUrl?: string | null;
}

interface VideoPlayerProps {
  /** Shared with the host page so its progress/heartbeat effects keep working. */
  videoRef: RefObject<HTMLVideoElement | null>;
  sources: PlayerSource[];
  subtitles: PlayerSubtitle[];
  /** Resume position in seconds (0 = start from the top). */
  resumeAt: number;
  title?: string;
  /** Series episodes (flattened, ordered) — enables prev/next + the list panel. */
  episodes?: PlayerEpisode[];
  currentEpisodeId?: string;
  /** Switch episode — the host navigates and re-feeds `sources`. */
  onSelectEpisode?: (episodeId: string) => void;
  /** Resolve a playable URL for an episode, for mid-frame thumbnail capture. */
  resolveEpisodeSource?: (episodeId: string) => Promise<string | null>;
  /** Backdrop/poster used when an episode has no thumbnail and capture fails. */
  posterFallback?: string | null;
  onBack: () => void;
  onPause?: () => void;
  onEnded?: () => void;
}

/** h:mm:ss when there are hours, otherwise m:ss. */
function fmt(input: number): string {
  const s = Number.isFinite(input) && input > 0 ? Math.floor(input) : 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${sec}`;
  return `${m}:${sec}`;
}

const SKIP = 15;
const IDLE_MS = 2800;

// Brand watermark geometry, as fractions of the film frame — so it looks
// identical in windowed and fullscreen. Tune these to move / resize the logo.
const WM_INSET_X = 0.025; // gap from the film's left edge (2.5% of width)
const WM_INSET_Y = 0.14; // gap from the film's top edge (4.5% of height)
const WM_SIZE = 0.075; // logo height (7.5% of film height); ↑ = bigger

export function VideoPlayer({
  videoRef,
  sources,
  subtitles,
  resumeAt,
  title,
  episodes,
  currentEpisodeId,
  onSelectEpisode,
  resolveEpisodeSource,
  posterFallback,
  onBack,
  onPause,
  onEnded,
}: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [epPanel, setEpPanel] = useState(false);

  // Episode navigation (series only). prevEp/nextEp drive the skip buttons.
  const epList = useMemo(() => episodes ?? [], [episodes]);
  const hasEpisodes = epList.length > 0 && Boolean(onSelectEpisode);
  const curIdx = currentEpisodeId
    ? epList.findIndex((e) => e.id === currentEpisodeId)
    : -1;
  const prevEp = curIdx > 0 ? epList[curIdx - 1] : null;
  const nextEp =
    curIdx >= 0 && curIdx < epList.length - 1 ? epList[curIdx + 1] : null;
  const goEpisode = useCallback(
    (id: string) => {
      setEpPanel(false);
      onSelectEpisode?.(id);
    },
    [onSelectEpisode],
  );

  const [activeIndex, setActiveIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [visible, setVisible] = useState(true);
  // Real element/native fullscreen. The container (with our logo overlay + custom
  // controls) goes fullscreen where the element Fullscreen API works; iPhone
  // Safari falls back to the native video player (see toggleFullscreen).
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [menu, setMenu] = useState<null | "quality" | "cc">(null);
  const [ccIndex, setCcIndex] = useState(-1); // -1 = off
  const [scrubbing, setScrubbing] = useState(false);
  const [hover, setHover] = useState<{ x: number; t: number } | null>(null);
  const [ripple, setRipple] = useState<{
    key: number;
    kind: "play" | "pause";
  } | null>(null);
  const [pipActive, setPipActive] = useState(false);
  // The actual film frame (top-left + size) inside the letterboxed <video>.
  const [frame, setFrame] = useState({ top: 0, left: 0, w: 0, h: 0 });

  const source = sources[activeIndex] ?? sources[0];

  const computeFrame = useCallback(() => {
    const v = videoRef.current;
    if (!v || !v.videoWidth || !v.videoHeight) return;
    const cw = v.clientWidth;
    const ch = v.clientHeight;
    const scale = Math.min(cw / v.videoWidth, ch / v.videoHeight);
    const w = v.videoWidth * scale;
    const h = v.videoHeight * scale;
    setFrame({ left: (cw - w) / 2, top: (ch - h) / 2, w, h });
  }, [videoRef]);

  useEffect(() => {
    computeFrame();
    const v = videoRef.current;

    // Entering fullscreen — on mobile this also rotates to landscape — fires
    // `fullscreenchange` *before* the <video> box has resized, so a synchronous
    // read still sees the old windowed dimensions and the watermark frame
    // collapses (logo disappears). Recompute once now and again after the
    // browser has settled the new layout.
    const recompute = () => {
      computeFrame();
      requestAnimationFrame(computeFrame);
    };

    // A ResizeObserver on the <video> is the reliable trigger: it always fires
    // with the correct post-layout box size for every resize — fullscreen,
    // orientation change, and window resize alike.
    let ro: ResizeObserver | null = null;
    if (v && typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => computeFrame());
      ro.observe(v);
    }

    window.addEventListener("resize", recompute);
    window.addEventListener("orientationchange", recompute);
    document.addEventListener("fullscreenchange", recompute);
    document.addEventListener("webkitfullscreenchange", recompute);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", recompute);
      window.removeEventListener("orientationchange", recompute);
      document.removeEventListener("fullscreenchange", recompute);
      document.removeEventListener("webkitfullscreenchange", recompute);
    };
  }, [computeFrame, activeIndex, videoRef]);

  // Seek target applied on the next loadedmetadata (resume, or quality switch).
  const seekTargetRef = useRef<number | null>(resumeAt > 0 ? resumeAt : null);
  const wasPlayingRef = useRef(true);
  // The viewer's intent. iOS unloads backgrounded media and reloads it with the
  // `autoPlay` attribute on return — which would resume a video the viewer had
  // paused. We track intent and re-assert a pause after any such reload.
  const userPausedRef = useRef(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Latest values for the idle timer's stale-closure-free reads.
  const playingRef = useRef(playing);
  const menuRef = useRef(menu);
  const scrubRef = useRef(scrubbing);
  useEffect(() => {
    playingRef.current = playing;
    menuRef.current = menu;
    scrubRef.current = scrubbing;
  });

  const prefersReducedMotion = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  // ----------------------------------------------------------- controls fade
  const revealControls = useCallback(() => {
    setVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (playingRef.current && !menuRef.current && !scrubRef.current) {
        setVisible(false);
      }
    }, IDLE_MS);
  }, []);

  const holdControls = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setVisible(true);
  }, []);

  // ------------------------------------------------------------- play / pause
  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      userPausedRef.current = false;
      v.play().catch(() => undefined);
      setRipple({ key: Date.now(), kind: "play" });
    } else {
      userPausedRef.current = true;
      v.pause();
      setRipple({ key: Date.now(), kind: "pause" });
    }
  }, [videoRef]);

  const seekBy = useCallback(
    (delta: number) => {
      const v = videoRef.current;
      if (!v) return;
      v.currentTime = Math.min(
        Math.max(0, v.currentTime + delta),
        v.duration || Infinity,
      );
      revealControls();
    },
    [videoRef, revealControls],
  );

  const seekTo = useCallback(
    (t: number) => {
      const v = videoRef.current;
      if (!v || !v.duration) return;
      v.currentTime = Math.min(Math.max(0, t), v.duration);
    },
    [videoRef],
  );

  const setVol = useCallback(
    (value: number) => {
      const v = videoRef.current;
      if (!v) return;
      const clamped = Math.min(1, Math.max(0, value));
      v.volume = clamped;
      v.muted = clamped === 0;
      setVolume(clamped);
      setMuted(clamped === 0);
    },
    [videoRef],
  );

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    const next = !v.muted;
    v.muted = next;
    setMuted(next);
    if (!next && v.volume === 0) setVol(0.5);
  }, [videoRef, setVol]);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const doc = document as Document & {
      webkitFullscreenElement?: Element;
      webkitExitFullscreen?: () => void;
    };
    const node = el as HTMLDivElement & {
      webkitRequestFullscreen?: () => void;
    };
    const video = videoRef.current as
      | (HTMLVideoElement & { webkitEnterFullscreen?: () => void })
      | null;

    // Already fullscreen → exit.
    if (doc.fullscreenElement || doc.webkitFullscreenElement) {
      (doc.exitFullscreen ?? doc.webkitExitFullscreen)?.call(doc);
      return;
    }

    // Fullscreen the CONTAINER (not the raw <video>) so our logo overlay + custom
    // controls ride along. Desktop/Android/iPadOS support element fullscreen.
    if (node.requestFullscreen) {
      node.requestFullscreen().catch(() => undefined);
    } else if (node.webkitRequestFullscreen) {
      node.webkitRequestFullscreen();
    } else if (video?.webkitEnterFullscreen) {
      // iPhone Safari can't fullscreen a wrapper <div> — only the <video> itself.
      // Fall back to the native video player there (real fullscreen + landscape).
      video.webkitEnterFullscreen();
    }
  }, [videoRef]);

  const togglePip = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await v.requestPictureInPicture();
      }
    } catch {
      /* user gesture / unsupported — ignore */
    }
  }, [videoRef]);

  // -------------------------------------------------- quality / subtitle menus
  const changeQuality = useCallback(
    (index: number) => {
      const v = videoRef.current;
      seekTargetRef.current = v?.currentTime ?? 0;
      wasPlayingRef.current = v ? !v.paused : true;
      setActiveIndex(index);
      setMenu(null);
    },
    [videoRef],
  );

  const applyCc = useCallback(
    (index: number) => {
      const v = videoRef.current;
      if (v) {
        Array.from(v.textTracks).forEach((track, i) => {
          track.mode = i === index ? "showing" : "hidden";
        });
      }
      setCcIndex(index);
      setMenu(null);
    },
    [videoRef],
  );

  // --------------------------------------------------------- fullscreen events
  useEffect(() => {
    function onFs() {
      const doc = document as Document & { webkitFullscreenElement?: Element };
      const active = Boolean(
        doc.fullscreenElement ?? doc.webkitFullscreenElement,
      );
      setIsFullscreen(active);
    }
    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("webkitfullscreenchange", onFs);
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      document.removeEventListener("webkitfullscreenchange", onFs);
    };
  }, []);

  // In real (element) fullscreen — desktop/Android/iPadOS — lock the screen to
  // landscape. iPhone uses the native video player, which handles this itself.
  useEffect(() => {
    if (!isFullscreen) return;
    const orientation = screen.orientation as ScreenOrientation & {
      lock?: (o: string) => Promise<void>;
      unlock?: () => void;
    };
    orientation?.lock?.("landscape")?.catch(() => undefined);
    return () => orientation?.unlock?.();
  }, [isFullscreen]);

  // Recompute the watermark frame whenever fullscreen flips.
  useEffect(() => {
    computeFrame();
    const raf = requestAnimationFrame(computeFrame);
    return () => cancelAnimationFrame(raf);
  }, [isFullscreen, computeFrame]);

  // Picture-in-picture state (events not typed on React's <video>).
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const enter = () => setPipActive(true);
    const leave = () => setPipActive(false);
    v.addEventListener("enterpictureinpicture", enter);
    v.addEventListener("leavepictureinpicture", leave);
    return () => {
      v.removeEventListener("enterpictureinpicture", enter);
      v.removeEventListener("leavepictureinpicture", leave);
    };
  }, [videoRef, activeIndex]);

  // Backup for the loadedmetadata guard: if the tab returns and the video is
  // playing despite the viewer having paused it, re-pause.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== "visible" || !userPausedRef.current) return;
      const v = videoRef.current;
      if (v && !v.paused) v.pause();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [videoRef]);


  // --------------------------------------------------------- keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowRight":
          e.preventDefault();
          seekBy(SKIP);
          break;
        case "ArrowLeft":
          e.preventDefault();
          seekBy(-SKIP);
          break;
        case "ArrowUp":
          e.preventDefault();
          setVol((videoRef.current?.volume ?? 0) + 0.1);
          break;
        case "ArrowDown":
          e.preventDefault();
          setVol((videoRef.current?.volume ?? 0) - 0.1);
          break;
        case "f":
          toggleFullscreen();
          break;
        case "m":
          toggleMute();
          break;
        default:
          return;
      }
      revealControls();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    togglePlay,
    seekBy,
    setVol,
    toggleFullscreen,
    toggleMute,
    revealControls,
    videoRef,
  ]);

  // --------------------------------------------------------------- scrub bar
  const barRef = useRef<HTMLDivElement>(null);
  const timeFromPointer = useCallback((clientX: number): number => {
    const el = barRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return ratio;
  }, []);

  const onScrubDown = useCallback(
    (e: React.PointerEvent) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      setScrubbing(true);
      const ratio = timeFromPointer(e.clientX);
      seekTo(ratio * (videoRef.current?.duration ?? 0));
    },
    [timeFromPointer, seekTo, videoRef],
  );

  const onScrubMove = useCallback(
    (e: React.PointerEvent) => {
      const ratio = timeFromPointer(e.clientX);
      const t = ratio * (videoRef.current?.duration ?? 0);
      setHover({ x: ratio, t });
      if (scrubRef.current) seekTo(t);
    },
    [timeFromPointer, seekTo, videoRef],
  );

  const onScrubUp = useCallback((e: React.PointerEvent) => {
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    setScrubbing(false);
  }, []);

  const progress = duration > 0 ? (current / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;

  const volumeIcon =
    muted || volume === 0 ? "mute" : volume < 0.5 ? "low" : "high";

  const inFullscreen = isFullscreen;

  return (
    <div
      ref={containerRef}
      onMouseMove={revealControls}
      onTouchStart={revealControls}
      onClick={() => menu && setMenu(null)}
      className={`fixed inset-0 z-[9999] select-none overflow-hidden bg-black ${
        !visible && playing ? "cursor-none" : ""
      }`}
    >
      {/* Video */}
      <video
        ref={videoRef}
        key={source?.id}
        src={source?.url}
        autoPlay
        playsInline
        crossOrigin="anonymous"
        className="h-full w-full object-contain"
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
        onPlay={() => {
          setPlaying(true);
          revealControls();
        }}
        onPause={() => {
          setPlaying(false);
          holdControls();
          onPause?.();
        }}
        onEnded={() => {
          setPlaying(false);
          holdControls();
          onEnded?.();
        }}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onCanPlay={() => setBuffering(false)}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onVolumeChange={(e) => {
          setVolume(e.currentTarget.volume);
          setMuted(e.currentTarget.muted);
        }}
        onProgress={(e) => {
          const v = e.currentTarget;
          try {
            if (v.buffered.length) {
              setBuffered(v.buffered.end(v.buffered.length - 1));
            }
          } catch {
            /* buffered can throw before metadata */
          }
        }}
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          setDuration(v.duration || 0);
          setVolume(v.volume);
          setMuted(v.muted);
          computeFrame();
          const target = seekTargetRef.current;
          if (target != null && target > 0) {
            v.currentTime = Math.min(
              target,
              Math.max(0, (v.duration || target) - 1),
            );
          }
          seekTargetRef.current = null;
          // `autoPlay` handles resuming; only override when it was paused
          // before a quality swap, or when the viewer had paused before iOS
          // reloaded the backgrounded media (don't let autoPlay override intent).
          if (!wasPlayingRef.current || userPausedRef.current) v.pause();
          // Re-apply the active subtitle after a source swap.
          if (ccIndex >= 0) {
            Array.from(v.textTracks).forEach((track, i) => {
              track.mode = i === ccIndex ? "showing" : "hidden";
            });
          }
        }}
      >
        {subtitles.map((s) => (
          <track
            key={s.id}
            kind="subtitles"
            src={s.url}
            srcLang={s.language}
            label={s.label}
          />
        ))}
      </video>

      {/* Brand watermark — pinned to the top-left of the actual film frame,
          clear of the letterbox bars, and kept in fullscreen. */}
      <div
        aria-hidden
        className="pointer-events-none absolute z-30 flex select-none items-center opacity-70 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] transition-all duration-300"
        style={{
          // Position and size are proportional to the film frame, so the
          // watermark looks identical in windowed and fullscreen modes.
          left: frame.left + frame.w * WM_INSET_X,
          top: frame.top + frame.h * WM_INSET_Y,
          gap: Math.max(frame.h * 0.02, 8),
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/infinity.png"
          alt=""
          style={{
            height: Math.min(Math.max(frame.h * WM_SIZE, 32), 96),
            width: "auto",
          }}
        />
        <span
          className="display font-bold tracking-tight text-white"
          style={{
            fontSize: Math.min(Math.max(frame.h * WM_SIZE * 0.86, 26), 84),
            lineHeight: 1,
          }}
        >
          INFINITE
        </span>
      </div>

      {/* Episode-change flash — keyed by the episode id so it replays on switch
          (and once on open), no state needed. */}
      {hasEpisodes && curIdx >= 0 ? (
        <div
          key={currentEpisodeId}
          className="player-ep-flash pointer-events-none absolute inset-0 z-40 grid place-items-center bg-black/65"
        >
          <div className="flex flex-col items-center gap-1.5 text-center">
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">
              Улирал {epList[curIdx].seasonNumber} · Анги {epList[curIdx].number}
            </span>
            <span className="max-w-[80vw] truncate px-4 text-xl font-bold text-white">
              {epList[curIdx].title}
            </span>
          </div>
        </div>
      ) : null}

      {/* Buffering ring */}
      {buffering ? (
        <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center">
          <span className="h-14 w-14 animate-spin rounded-full border-[3px] border-white/15 border-t-accent shadow-[0_0_28px_rgba(124,140,255,0.5)]" />
        </div>
      ) : null}

      {/* Center tap ripple */}
      {ripple && !prefersReducedMotion ? (
        <div
          key={ripple.key}
          aria-hidden
          onAnimationEnd={() => setRipple(null)}
          className="pointer-events-none absolute inset-0 z-20 grid place-items-center"
        >
          <span className="player-ripple grid h-20 w-20 origin-center place-items-center rounded-full bg-white/10 text-white backdrop-blur-sm">
            {ripple.kind === "play" ? (
              <IcoPlay size={30} />
            ) : (
              <IcoPause size={30} />
            )}
          </span>
        </div>
      ) : null}

      {/* Big center play button when paused */}
      {!playing && !buffering ? (
        <button
          type="button"
          onClick={togglePlay}
          aria-label="Тоглуулах"
          className="absolute inset-0 z-20 grid place-items-center"
        >
          <span className="grid h-20 w-20 place-items-center rounded-full bg-accent text-white shadow-[0_0_40px_rgba(124,140,255,0.55)] transition duration-200 hover:scale-105 hover:bg-accent-hover active:scale-95">
            <IcoPlay size={34} />
          </span>
        </button>
      ) : null}

      {/* ---------------------------------------------------------- top bar */}
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center gap-3 bg-gradient-to-b from-black/75 via-black/25 to-transparent px-4 pb-14 pt-4 transition-opacity duration-300 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      >
        <button
          type="button"
          onClick={onBack}
          className="pointer-events-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-white/85 transition hover:bg-white/10 hover:text-white active:scale-95"
        >
          <IconArrowLeft size={17} />
          Буцах
        </button>
        {title ? (
          <p className="pointer-events-none truncate text-sm font-semibold text-white/70">
            {title}
          </p>
        ) : null}
      </div>

      {/* ------------------------------------------------------- bottom bar */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={`absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-3 pb-3 pt-16 transition-all duration-300 sm:px-5 ${
          visible
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-3 opacity-0"
        }`}
      >
        {/* Scrubber */}
        <div className="group/bar relative mb-2 flex items-center">
          <div
            ref={barRef}
            role="slider"
            aria-label="Гүйлгэх"
            aria-valuemin={0}
            aria-valuemax={Math.floor(duration)}
            aria-valuenow={Math.floor(current)}
            tabIndex={0}
            onPointerDown={onScrubDown}
            onPointerMove={onScrubMove}
            onPointerUp={onScrubUp}
            onPointerLeave={() => setHover(null)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") seekBy(SKIP);
              else if (e.key === "ArrowLeft") seekBy(-SKIP);
            }}
            className="relative flex h-6 w-full cursor-pointer items-center"
          >
            {/* track */}
            <div className="relative h-1 w-full overflow-visible rounded-full bg-white/20 transition-all duration-150 group-hover/bar:h-1.5">
              {/* buffered */}
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-white/25"
                style={{ width: `${bufferedPct}%` }}
              />
              {/* played — the projector beam */}
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-accent-strong to-accent shadow-[0_0_10px_rgba(124,140,255,0.7)]"
                style={{ width: `${progress}%` }}
              />
              {/* thumb */}
              <span
                className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 scale-0 rounded-full bg-white shadow-[0_0_12px_rgba(124,140,255,0.9)] transition-transform duration-150 group-hover/bar:scale-100"
                style={{ left: `${progress}%` }}
              />
            </div>

            {/* hover time tooltip */}
            {hover ? (
              <div
                className="pointer-events-none absolute -top-9 -translate-x-1/2 rounded-md bg-black/85 px-2 py-1 text-xs font-semibold text-white shadow-pop"
                style={{ left: `${hover.x * 100}%` }}
              >
                {fmt(hover.t)}
              </div>
            ) : null}
          </div>
        </div>

        {/* Control row */}
        <div className="flex items-center gap-1 text-white sm:gap-1.5">
          <CtrlButton
            onClick={togglePlay}
            label={playing ? "Түр зогсоох" : "Тоглуулах"}
          >
            {playing ? <IcoPause size={22} /> : <IcoPlay size={22} />}
          </CtrlButton>

          <CtrlButton onClick={() => seekBy(-SKIP)} label="15 секунд ухраах">
            <IcoBack15 size={22} />
          </CtrlButton>
          <CtrlButton
            onClick={() => seekBy(SKIP)}
            label="15 секунд урагшлуулах"
          >
            <IcoFwd15 size={22} />
          </CtrlButton>

          {/* Prev / next episode (series only) */}
          {hasEpisodes ? (
            <>
              <CtrlButton
                onClick={() => prevEp && goEpisode(prevEp.id)}
                label="Өмнөх анги"
                disabled={!prevEp}
              >
                <IcoPrevEp size={22} />
              </CtrlButton>
              <CtrlButton
                onClick={() => nextEp && goEpisode(nextEp.id)}
                label="Дараагийн анги"
                disabled={!nextEp}
              >
                <IcoNextEp size={22} />
              </CtrlButton>
            </>
          ) : null}

          {/* Volume */}
          <div className="group/vol flex items-center">
            <CtrlButton
              onClick={toggleMute}
              label={muted ? "Дуу нээх" : "Дуу хаах"}
            >
              {volumeIcon === "mute" ? (
                <IcoVolMute size={22} />
              ) : volumeIcon === "low" ? (
                <IcoVolLow size={22} />
              ) : (
                <IcoVolHigh size={22} />
              )}
            </CtrlButton>
            <div className="flex w-0 items-center overflow-hidden opacity-0 transition-all duration-200 group-hover/vol:w-24 group-hover/vol:opacity-100 group-focus-within/vol:w-24 group-focus-within/vol:opacity-100">
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={muted ? 0 : volume}
                onChange={(e) => setVol(Number(e.target.value))}
                aria-label="Дууны түвшин"
                className="player-range h-1 w-20"
                style={
                  {
                    "--fill": `${(muted ? 0 : volume) * 100}%`,
                  } as React.CSSProperties
                }
              />
            </div>
          </div>

          <span className="ml-1 whitespace-nowrap text-xs font-semibold tabular-nums text-white/80 sm:text-sm">
            {fmt(current)}{" "}
            <span className="text-white/40">/ {fmt(duration)}</span>
          </span>

          <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
            {/* Episodes list */}
            {hasEpisodes ? (
              <CtrlButton
                onClick={() => setEpPanel(true)}
                label="Ангиуд"
                active={epPanel}
              >
                <IcoList size={22} />
              </CtrlButton>
            ) : null}

            {/* Quality */}
            {sources.length > 1 ? (
              <Popover
                open={menu === "quality"}
                onToggle={() => setMenu(menu === "quality" ? null : "quality")}
                label="Чанар"
                trigger={<IcoSettings size={22} />}
              >
                <MenuHeader>Чанар</MenuHeader>
                {sources.map((s, i) => (
                  <MenuItem
                    key={s.id}
                    active={i === activeIndex}
                    onClick={() => changeQuality(i)}
                  >
                    {s.label}
                  </MenuItem>
                ))}
              </Popover>
            ) : null}

            {/* Subtitles */}
            {subtitles.length > 0 ? (
              <Popover
                open={menu === "cc"}
                onToggle={() => setMenu(menu === "cc" ? null : "cc")}
                label="Хадмал"
                active={ccIndex >= 0}
                trigger={<IcoCc size={24} />}
              >
                <MenuHeader>Хадмал</MenuHeader>
                <MenuItem active={ccIndex === -1} onClick={() => applyCc(-1)}>
                  Хаах
                </MenuItem>
                {subtitles.map((s, i) => (
                  <MenuItem
                    key={s.id}
                    active={ccIndex === i}
                    onClick={() => applyCc(i)}
                  >
                    {s.label}
                  </MenuItem>
                ))}
              </Popover>
            ) : null}

            {typeof document !== "undefined" &&
            "pictureInPictureEnabled" in document ? (
              <CtrlButton
                onClick={togglePip}
                label="Жижиг цонх"
                active={pipActive}
              >
                <IcoPip size={22} />
              </CtrlButton>
            ) : null}

            <CtrlButton
              onClick={toggleFullscreen}
              label={inFullscreen ? "Бүтэн дэлгэцээс гарах" : "Бүтэн дэлгэц"}
            >
              {inFullscreen ? (
                <IcoFsExit size={22} />
              ) : (
                <IcoFsEnter size={22} />
              )}
            </CtrlButton>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------- episodes panel */}
      {hasEpisodes && epPanel ? (
        <div className="absolute inset-0 z-40">
          <button
            type="button"
            aria-label="Хаах"
            onClick={() => setEpPanel(false)}
            className="animate-fade absolute inset-0 bg-black/55"
          />
          <div className="animate-slide-left absolute right-0 top-0 flex h-full w-[min(92vw,400px)] flex-col border-l border-white/10 bg-[#0b0f1a]/95 shadow-[-8px_0_50px_rgba(0,0,0,0.65)] backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3.5">
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground">Ангиуд</p>
                <p className="text-xs text-muted">{epList.length} анги</p>
              </div>
              <button
                type="button"
                onClick={() => setEpPanel(false)}
                aria-label="Хаах"
                className="grid h-9 w-9 place-items-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white active:scale-90"
              >
                <IcoClose size={20} />
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 py-2">
              {epList.map((ep) => (
                <EpisodeRow
                  key={ep.id}
                  episode={ep}
                  active={ep.id === currentEpisodeId}
                  onSelect={() => goEpisode(ep.id)}
                  resolveSource={resolveEpisodeSource}
                  fallback={posterFallback}
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- primitives

function CtrlButton({
  children,
  onClick,
  label,
  active,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`grid h-9 w-9 place-items-center rounded-lg transition duration-150 hover:bg-white/15 active:scale-90 disabled:pointer-events-none disabled:opacity-30 sm:h-10 sm:w-10 ${
        active ? "text-accent" : "text-white/90 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function Popover({
  open,
  onToggle,
  label,
  trigger,
  active,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  label: string;
  trigger: React.ReactNode;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <CtrlButton onClick={onToggle} label={label} active={active || open}>
        {trigger}
      </CtrlButton>
      {open ? (
        <div className="player-menu absolute bottom-12 right-0 min-w-[9rem] origin-bottom-right overflow-hidden rounded-xl border border-white/10 bg-[#0d1220]/95 py-1 shadow-pop backdrop-blur-md">
          {children}
        </div>
      ) : null}
    </div>
  );
}

function MenuHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white/40">
      {children}
    </p>
  );
}

function MenuItem({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-3 px-3.5 py-2 text-sm font-medium transition ${
        active
          ? "text-accent"
          : "text-white/85 hover:bg-white/10 hover:text-white"
      }`}
    >
      {children}
      {active ? <IcoCheck size={16} /> : <span className="w-4" />}
    </button>
  );
}

// -------------------------------------------------------------------- icons
// Stroke-based, matching the app's Lucide-style icon set.

type Ico = { size?: number };
const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function IcoPlay({ size = 24 }: Ico) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M7 5.2c0-.9 1-1.5 1.8-1L19 10.3c.7.5.7 1.6 0 2L8.8 18.6c-.8.5-1.8-.1-1.8-1V5.2Z" />
    </svg>
  );
}
function IcoPause({ size = 24 }: Ico) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <rect x="6" y="5" width="4" height="14" rx="1.3" />
      <rect x="14" y="5" width="4" height="14" rx="1.3" />
    </svg>
  );
}
function IcoBack15({ size = 24 }: Ico) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} aria-hidden>
      <path d="M11 4 4.5 8 11 12V4Z" fill="currentColor" stroke="none" />
      <path d="M9 8h4a7 7 0 1 1-7 7" />
      <text
        x="12.5"
        y="17"
        fontSize="7"
        fontWeight="700"
        fill="currentColor"
        stroke="none"
        textAnchor="middle"
      >
        15
      </text>
    </svg>
  );
}
function IcoFwd15({ size = 24 }: Ico) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} aria-hidden>
      <path d="M13 4 19.5 8 13 12V4Z" fill="currentColor" stroke="none" />
      <path d="M15 8h-4a7 7 0 1 0 7 7" />
      <text
        x="12"
        y="17"
        fontSize="7"
        fontWeight="700"
        fill="currentColor"
        stroke="none"
        textAnchor="middle"
      >
        15
      </text>
    </svg>
  );
}
function IcoVolHigh({ size = 24 }: Ico) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} aria-hidden>
      <path
        d="M4 9v6h3l5 4V5L7 9H4Z"
        fill="currentColor"
        stroke="currentColor"
      />
      <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" />
    </svg>
  );
}
function IcoVolLow({ size = 24 }: Ico) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} aria-hidden>
      <path
        d="M4 9v6h3l5 4V5L7 9H4Z"
        fill="currentColor"
        stroke="currentColor"
      />
      <path d="M16 8.5a5 5 0 0 1 0 7" />
    </svg>
  );
}
function IcoVolMute({ size = 24 }: Ico) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} aria-hidden>
      <path
        d="M4 9v6h3l5 4V5L7 9H4Z"
        fill="currentColor"
        stroke="currentColor"
      />
      <path d="m16 9 5 6M21 9l-5 6" />
    </svg>
  );
}
function IcoSettings({ size = 24 }: Ico) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}
function IcoCc({ size = 24 }: Ico) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="M10 10.5a2 2 0 0 0-3 1.7 2 2 0 0 0 3 1.8M17 10.5a2 2 0 0 0-3 1.7 2 2 0 0 0 3 1.8" />
    </svg>
  );
}
function IcoPip({ size = 24 }: Ico) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} aria-hidden>
      <rect x="3" y="4.5" width="18" height="15" rx="3" />
      <rect
        x="12"
        y="11"
        width="7"
        height="6"
        rx="1.5"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}
function IcoFsEnter({ size = 24 }: Ico) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} aria-hidden>
      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3m8 0h3a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}
function IcoFsExit({ size = 24 }: Ico) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} aria-hidden>
      <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3m8 0v-3a2 2 0 0 1 2-2h3" />
    </svg>
  );
}
function IcoCheck({ size = 16 }: Ico) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} aria-hidden>
      <path d="m5 12 5 5L20 6" />
    </svg>
  );
}
function IcoPrevEp({ size = 24 }: Ico) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} aria-hidden>
      <path d="M17 6 8 12l9 6V6Z" fill="currentColor" stroke="none" />
      <path d="M6 5v14" />
    </svg>
  );
}
function IcoNextEp({ size = 24 }: Ico) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} aria-hidden>
      <path d="M7 6l9 6-9 6V6Z" fill="currentColor" stroke="none" />
      <path d="M18 5v14" />
    </svg>
  );
}
function IcoList({ size = 24 }: Ico) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} aria-hidden>
      <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
    </svg>
  );
}
function IcoClose({ size = 24 }: Ico) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} aria-hidden>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

// -------------------------------------------------------- episode list panel

// Serialize frame captures so opening a long series doesn't spawn N decoders at
// once; results are cached across opens for the session.
let captureChain: Promise<unknown> = Promise.resolve();
const thumbCache = new Map<string, string>();

/** Grab a JPEG data URL from the middle of a video via a hidden <video> + canvas. */
function captureVideoFrame(url: string, atRatio = 0.5): Promise<string | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.preload = "metadata";
    video.playsInline = true;
    let settled = false;
    const finish = (v: string | null) => {
      if (settled) return;
      settled = true;
      video.removeAttribute("src");
      video.load();
      resolve(v);
    };
    video.onloadedmetadata = () => {
      const d = video.duration;
      video.currentTime = Number.isFinite(d) && d > 0 ? d * atRatio : 1;
    };
    video.onseeked = () => {
      try {
        const w = video.videoWidth || 320;
        const h = video.videoHeight || 180;
        const canvas = document.createElement("canvas");
        canvas.width = 320;
        canvas.height = Math.round((320 * h) / w) || 180;
        const ctx = canvas.getContext("2d");
        if (!ctx) return finish(null);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        finish(canvas.toDataURL("image/jpeg", 0.72));
      } catch {
        // Tainted canvas — the signed URL lacks CORS headers. Fall back quietly.
        finish(null);
      }
    };
    video.onerror = () => finish(null);
    setTimeout(() => finish(null), 9000);
    video.src = url;
  });
}

function EpisodeRow({
  episode,
  active,
  onSelect,
  resolveSource,
  fallback,
}: {
  episode: PlayerEpisode;
  active: boolean;
  onSelect: () => void;
  resolveSource?: (episodeId: string) => Promise<string | null>;
  fallback?: string | null;
}) {
  const [thumb, setThumb] = useState<string | null>(
    episode.thumbnailUrl ?? thumbCache.get(episode.id) ?? null,
  );

  // No stored thumbnail → lazily grab a mid-video frame (queued + cached).
  useEffect(() => {
    if (thumb || !resolveSource) return;
    let cancelled = false;
    captureChain = captureChain.then(async () => {
      if (cancelled) return;
      const cached = thumbCache.get(episode.id);
      if (cached) {
        setThumb(cached);
        return;
      }
      const url = await resolveSource(episode.id);
      if (!url || cancelled) return;
      const frame = await captureVideoFrame(url, 0.5);
      if (frame) {
        thumbCache.set(episode.id, frame);
        if (!cancelled) setThumb(frame);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [episode.id, resolveSource, thumb]);

  const mins = episode.durationSec ? Math.round(episode.durationSec / 60) : null;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center gap-3 rounded-xl border px-2.5 py-2 text-left transition ${
        active
          ? "border-accent/60 bg-accent/10"
          : "border-transparent hover:border-white/10 hover:bg-white/5"
      }`}
    >
      <span
        className={`w-5 shrink-0 text-center text-sm font-bold ${
          active ? "text-accent" : "text-white/40"
        }`}
      >
        {episode.number}
      </span>
      <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded-md bg-white/[.06]">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" className="h-full w-full object-cover" />
        ) : fallback ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={fallback}
            alt=""
            className="h-full w-full object-cover opacity-60"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-[#1e2a4d] to-[#0a0e17]" />
        )}
        {active ? (
          <span className="absolute inset-0 grid place-items-center bg-black/40">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-accent text-white">
              <IcoPlay size={13} />
            </span>
          </span>
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-sm font-semibold ${
            active ? "text-foreground" : "text-white/85"
          }`}
        >
          {episode.title}
        </p>
        <p className="truncate text-xs text-muted">
          {active
            ? "Одоо тоглож байна"
            : mins
              ? `${mins} мин`
              : `Анги ${episode.number}`}
        </p>
      </div>
    </button>
  );
}
