"use client";

import { useEffect, useRef } from "react";

/**
 * Animated "line waves" backdrop — a field of flowing horizontal contours
 * in the projector's indigo, with a soft glow and a gentle bulge that
 * follows the cursor. Pure canvas 2D: no WebGL, no dependencies. Renders a
 * single static frame for reduced-motion users.
 */
export function LineWaves({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const cv = canvas;
    const c = ctx;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let width = 0;
    let height = 0;
    const mouse = { x: -9999, y: -9999, active: false };

    function resize() {
      width = cv.clientWidth;
      height = cv.clientHeight;
      cv.width = Math.max(1, Math.floor(width * dpr));
      cv.height = Math.max(1, Math.floor(height * dpr));
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    function onMove(e: MouseEvent) {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.active = true;
    }
    function onLeave() {
      mouse.active = false;
    }
    if (!coarse) {
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseleave", onLeave);
    }

    const LINES = 26;
    const SIGMA = 150; // cursor bulge radius
    const STRENGTH = 46; // cursor bulge height

    function draw(t: number) {
      c.clearRect(0, 0, width, height);
      const time = t * 0.001;
      const step = Math.max(10, width / 120);

      for (let i = 0; i < LINES; i++) {
        const p = i / (LINES - 1); // 0 (top) … 1 (bottom)
        const baseY = height * (0.1 + p * 0.86);
        const amp = 14 + Math.sin(i * 0.7) * 8 + p * 26;
        const freq = 0.6 + (i % 5) * 0.12;
        const speed = 0.5 + (i % 3) * 0.22;
        const phase = i * 0.55;

        c.beginPath();
        for (let x = -step; x <= width + step; x += step) {
          const nx = x / width;
          let y =
            baseY +
            Math.sin(nx * Math.PI * 2 * freq + time * speed + phase) * amp +
            Math.sin(nx * Math.PI * 2 * freq * 0.5 - time * speed * 0.6 + phase) *
              amp *
              0.4;

          if (mouse.active) {
            const dx = x - mouse.x;
            const dy = baseY - mouse.y;
            const d2 = dx * dx + dy * dy;
            y -= STRENGTH * Math.exp(-d2 / (2 * SIGMA * SIGMA));
          }

          if (x === -step) c.moveTo(x, y);
          else c.lineTo(x, y);
        }

        // Indigo throughout, a few teal contours woven in for depth.
        const teal = i % 7 === 3;
        const rgb = teal ? "86,207,201" : "124,140,255";
        const center = 1 - Math.abs(p - 0.5) * 1.1; // brighter toward the middle
        const alpha = 0.05 + 0.12 * Math.max(0, center);

        // Soft glow pass, then a crisp line.
        c.strokeStyle = `rgba(${rgb},${alpha * 0.5})`;
        c.lineWidth = 3;
        c.stroke();
        c.strokeStyle = `rgba(${rgb},${alpha})`;
        c.lineWidth = 1;
        c.stroke();
      }
    }

    let raf = 0;
    if (reduce) {
      draw(0);
    } else {
      const loop = (t: number) => {
        draw(t);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={`h-full w-full ${className}`}
    />
  );
}
