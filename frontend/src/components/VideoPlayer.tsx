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

interface VideoPlayerProps {
  /** Shared with the host page so its progress/heartbeat effects keep working. */
  videoRef: RefObject<HTMLVideoElement | null>;
  sources: PlayerSource[];
  subtitles: PlayerSubtitle[];
  /** Resume position in seconds (0 = start from the top). */
  resumeAt: number;
  title?: string;
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
  onBack,
  onPause,
  onEnded,
}: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const [activeIndex, setActiveIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [visible, setVisible] = useState(true);
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
    window.addEventListener("resize", computeFrame);
    document.addEventListener("fullscreenchange", computeFrame);
    document.addEventListener("webkitfullscreenchange", computeFrame);
    return () => {
      window.removeEventListener("resize", computeFrame);
      document.removeEventListener("fullscreenchange", computeFrame);
      document.removeEventListener("webkitfullscreenchange", computeFrame);
    };
  }, [computeFrame, activeIndex]);

  // Seek target applied on the next loadedmetadata (resume, or quality switch).
  const seekTargetRef = useRef<number | null>(resumeAt > 0 ? resumeAt : null);
  const wasPlayingRef = useRef(true);
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
      v.play().catch(() => undefined);
      setRipple({ key: Date.now(), kind: "play" });
    } else {
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
    if (doc.fullscreenElement || doc.webkitFullscreenElement) {
      (doc.exitFullscreen ?? doc.webkitExitFullscreen)?.call(doc);
    } else {
      (node.requestFullscreen ?? node.webkitRequestFullscreen)?.call(node);
    }
  }, []);

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
      setIsFullscreen(
        Boolean(doc.fullscreenElement ?? doc.webkitFullscreenElement),
      );
    }
    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("webkitfullscreenchange", onFs);
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      document.removeEventListener("webkitfullscreenchange", onFs);
    };
  }, []);

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

  return (
    <div
      ref={containerRef}
      onMouseMove={revealControls}
      onTouchStart={revealControls}
      onClick={() => menu && setMenu(null)}
      className={`relative h-screen w-screen select-none overflow-hidden bg-black ${
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
          // before a quality swap (avoids racing play() against the load).
          if (!wasPlayingRef.current) v.pause();
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
              label={isFullscreen ? "Бүтэн дэлгэцээс гарах" : "Бүтэн дэлгэц"}
            >
              {isFullscreen ? (
                <IcoFsExit size={22} />
              ) : (
                <IcoFsEnter size={22} />
              )}
            </CtrlButton>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- primitives

function CtrlButton({
  children,
  onClick,
  label,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`grid h-9 w-9 place-items-center rounded-lg transition duration-150 hover:bg-white/15 active:scale-90 sm:h-10 sm:w-10 ${
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
