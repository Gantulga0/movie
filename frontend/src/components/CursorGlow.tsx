"use client";

import { useEffect, useRef } from "react";

/**
 * A soft cone of indigo light that trails the pointer — the projector
 * following the viewer's eye. Purely decorative: pointer-events pass
 * through, mouse-only devices, and reduced-motion users opt out.
 */
export function CursorGlow() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let targetX = 0;
    let targetY = 0;
    let x = 0;
    let y = 0;
    let seen = false;

    const tick = () => {
      x += (targetX - x) * 0.16;
      y += (targetY - y) * 0.16;
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      raf =
        Math.abs(targetX - x) > 0.5 || Math.abs(targetY - y) > 0.5
          ? requestAnimationFrame(tick)
          : 0;
    };

    const onMove = (e: MouseEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;
      if (!seen) {
        seen = true;
        x = targetX;
        y = targetY;
        el.style.opacity = "1";
      }
      if (!raf) raf = requestAnimationFrame(tick);
    };

    const onLeave = () => {
      el.style.opacity = "0";
      seen = false;
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[80] opacity-0 transition-opacity duration-500"
    >
      <div
        className="h-[340px] w-[340px] -translate-x-1/2 -translate-y-1/2 rounded-full mix-blend-screen"
        style={{
          background:
            "radial-gradient(closest-side, rgba(124,140,255,0.10), rgba(124,140,255,0.04) 45%, transparent 70%)",
        }}
      />
    </div>
  );
}
