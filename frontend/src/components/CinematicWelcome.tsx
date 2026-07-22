"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";

/** Fade-in over the auth screen — long enough to fully cover before we route. */
const IN_MS = 440;
/** Held ignition once the stage is opaque and the destination is mounting. */
const HOLD_MS = 1320;
/** Dissolve that reveals the loaded home page beneath. */
const OUT_MS = 500;

interface CinematicWelcomeProps {
  /** Fired once the stage is fully opaque — safe to route underneath. */
  onCovered: () => void;
  /** Fired after the dissolve — tear the overlay down. */
  onDone: () => void;
}

/**
 * Sign-in hand-off: the projector warms up. The stage fades in over the auth
 * screen, the Infinite mark ignites in a cone of light with rings pulsing
 * out and a light sweeping the wordmark, then the whole stage dissolves to
 * reveal home. It masks the first data load so the transition reads as a lit
 * cinema, never a stall.
 */
export function CinematicWelcome({ onCovered, onDone }: CinematicWelcomeProps) {
  const { user } = useAuth();
  const [shown, setShown] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const t0 = setTimeout(() => setShown(true), 20); // trigger the fade-in
    const t1 = setTimeout(onCovered, IN_MS); // opaque → route underneath
    const t2 = setTimeout(() => {
      setLeaving(true);
      setShown(false); // begin the dissolve
    }, IN_MS + HOLD_MS);
    const t3 = setTimeout(onDone, IN_MS + HOLD_MS + OUT_MS);
    return () => {
      clearTimeout(t0);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onCovered, onDone]);

  return (
    <div
      aria-hidden
      className="fixed inset-0 z-[130] grid place-items-center overflow-hidden transition-opacity ease-out"
      style={{
        opacity: shown ? 1 : 0,
        transitionDuration: `${leaving ? OUT_MS : IN_MS}ms`,
      }}
    >
      {/* Stage backdrop — the indigo field auth and home both share, so
          nothing flickers on the way in or out. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(130% 110% at 50% 42%, #1c2647 0%, #10162b 45%, #05080f 100%)",
        }}
      />
      {/* Projector cone falling from the top of the frame. */}
      <div className="welcome-beam absolute inset-x-0 top-0 h-2/3" />

      <div className="relative flex flex-col items-center">
        <div className="welcome-mark relative flex items-center gap-3">
          <span className="welcome-ring" />
          <span className="welcome-ring welcome-ring-2" />
          <span className="welcome-glow" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/infinity.png"
            alt=""
            className="relative h-14 w-auto sm:h-16"
          />
          <span className="display relative text-5xl font-bold tracking-tight text-white sm:text-6xl">
            INFINITE
          </span>
          {/* Light sweeping across the mark. */}
          <span className="welcome-shine" />
        </div>

        <p className="welcome-greet mt-7 text-xs font-bold uppercase text-accent">
          {user?.name ? `Тавтай морил, ${user.name}` : "Тавтай морилно уу"}
        </p>

        <div className="mt-8 h-[3px] w-44 overflow-hidden rounded-full bg-white/10">
          <div className="welcome-loader h-full w-1/3 rounded-full bg-gradient-to-r from-transparent via-accent to-transparent" />
        </div>
      </div>
    </div>
  );
}
