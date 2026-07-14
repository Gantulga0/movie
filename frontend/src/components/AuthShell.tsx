"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { contentApi } from "@/lib/api";
import { Logo } from "./Logo";

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}

/**
 * Auth stage: a dark cinema hall with a projector beam and floating
 * translucent "screen frames" in 3D depth. The scene tilts a few degrees
 * toward the cursor (pure CSS transforms — no WebGL, no dependencies) and
 * collapses to a calm gradient on mobile and for reduced-motion users.
 */
export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const [posters, setPosters] = useState<string[]>([]);

  // Real posters for the floating frames; the scene is desktop-only, so
  // skip the request entirely on small screens. Failure just keeps the
  // abstract glow frames.
  useEffect(() => {
    if (!window.matchMedia("(min-width: 768px)").matches) return;
    contentApi
      .list({ sort: "watched", limit: 8 })
      .then((res) =>
        setPosters(
          res.items
            .map((c) => c.posterUrl)
            .filter((u): u is string => Boolean(u))
            .slice(0, 4),
        ),
      )
      .catch(() => setPosters([]));
  }, []);

  // Cursor parallax: rotate the whole scene a few degrees, rAF-throttled.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;

    let frame = 0;
    function onMove(e: MouseEvent) {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const x = e.clientX / window.innerWidth - 0.5;
        const y = e.clientY / window.innerHeight - 0.5;
        scene!.style.transform = `rotateY(${x * 5}deg) rotateX(${-y * 4}deg)`;
      });
    }
    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <main className="relative isolate flex min-h-screen flex-col overflow-hidden bg-background-deep">
      {/* Stage backdrop */}
      <div className="absolute inset-0 -z-20">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(130% 110% at 50% -10%, #1c2647 0%, #10162b 42%, #05080f 100%)",
          }}
        />
        <div className="projector-light absolute inset-0" />
      </div>

      {/* 3D depth scene — decorative only, never intercepts input. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 hidden md:block"
        style={{ perspective: "1200px" }}
      >
        <div
          ref={sceneRef}
          className="absolute inset-0 transition-transform duration-300 ease-out"
          style={{ transformStyle: "preserve-3d" }}
        >
          {/* Floating movie posters at different depths */}
          <SceneFrame
            className="left-[9%] top-[12%] h-64 w-44"
            depth={-180}
            rx="6deg"
            ry="14deg"
            delay="0s"
            poster={posters[0]}
          />
          <SceneFrame
            className="right-[11%] top-[10%] h-56 w-40"
            depth={-320}
            rx="-4deg"
            ry="-16deg"
            delay="-3s"
            poster={posters[1]}
          />
          <SceneFrame
            className="bottom-[10%] left-[15%] h-52 w-36"
            depth={-420}
            rx="8deg"
            ry="10deg"
            delay="-6s"
            poster={posters[2]}
          />
          <SceneFrame
            className="bottom-[12%] right-[8%] h-72 w-48"
            depth={-140}
            rx="-6deg"
            ry="-10deg"
            delay="-4.5s"
            poster={posters[3]}
          />

          {/* Film strip running down the far left */}
          <div
            className="animate-drift absolute -left-8 top-[6%] h-[88%] w-14 rounded-lg border border-white/[.06] bg-white/[.03]"
            style={
              {
                transform: "translateZ(-500px) rotateY(24deg)",
                "--rx": "0deg",
                "--ry": "24deg",
                animationDelay: "-2s",
                backgroundImage:
                  "repeating-linear-gradient(to bottom, transparent 0 14px, rgba(151,168,214,0.12) 14px 26px)",
              } as React.CSSProperties
            }
          />

          {/* Depth particles: faint bokeh lights hanging in the hall */}
          {PARTICLES.map((p, i) => (
            <span
              key={i}
              className="animate-drift absolute rounded-full"
              style={
                {
                  left: p.left,
                  top: p.top,
                  width: p.size,
                  height: p.size,
                  background: p.color,
                  filter: `blur(${p.blur}px)`,
                  transform: `translateZ(${p.depth}px)`,
                  animationDelay: p.delay,
                  animationDuration: p.duration,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      </div>

      <header className="px-5 py-5 sm:px-10 sm:py-6">
        <Logo />
      </header>

      <div className="flex flex-1 items-center justify-center px-5 py-8">
        <div className="animate-rise w-full max-w-md rounded-2xl border border-white/10 bg-background-deep/55 p-7 shadow-pop backdrop-blur-xl sm:p-9">
          <h1 className="display text-3xl font-bold text-foreground">{title}</h1>
          <p className="mt-2 text-sm text-muted">{subtitle}</p>

          <div className="mt-7">{children}</div>

          <div className="mt-6 text-center text-sm text-muted">{footer}</div>
        </div>
      </div>
    </main>
  );
}

/** A poster frame hanging in the depth of the hall; glows until data arrives. */
function SceneFrame({
  className,
  depth,
  rx,
  ry,
  delay,
  poster,
}: {
  className: string;
  depth: number;
  rx: string;
  ry: string;
  delay: string;
  poster?: string;
}) {
  return (
    <div
      className={`animate-drift absolute overflow-hidden rounded-xl border border-white/[.08] bg-gradient-to-br from-white/[.06] to-white/[.015] shadow-pop backdrop-blur-[2px] ${className}`}
      style={
        {
          transform: `translateZ(${depth}px) rotateX(${rx}) rotateY(${ry})`,
          "--rx": rx,
          "--ry": ry,
          animationDelay: delay,
        } as React.CSSProperties
      }
    >
      {poster ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={poster}
            alt=""
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover opacity-75"
          />
          {/* Dim toward the hall so the form stays the brightest thing on stage */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#05080f]/70 via-transparent to-[#05080f]/30" />
        </>
      ) : (
        <div className="absolute inset-2 rounded-lg bg-gradient-to-br from-accent/[.09] via-transparent to-teal/[.05]" />
      )}
    </div>
  );
}

const PARTICLES = [
  { left: "22%", top: "30%", size: 5, color: "rgba(124,140,255,0.5)", blur: 2, depth: -240, delay: "-1s", duration: "11s" },
  { left: "70%", top: "24%", size: 4, color: "rgba(86,207,201,0.45)", blur: 2, depth: -360, delay: "-5s", duration: "13s" },
  { left: "34%", top: "68%", size: 6, color: "rgba(230,185,94,0.35)", blur: 3, depth: -160, delay: "-8s", duration: "10s" },
  { left: "82%", top: "58%", size: 5, color: "rgba(124,140,255,0.4)", blur: 2, depth: -300, delay: "-3s", duration: "12s" },
  { left: "12%", top: "52%", size: 3, color: "rgba(242,239,232,0.4)", blur: 1, depth: -420, delay: "-6s", duration: "14s" },
];

export function AuthLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="font-semibold text-accent transition hover:text-accent-hover"
    >
      {children}
    </Link>
  );
}
