"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CinematicWelcome } from "@/components/CinematicWelcome";

interface WelcomeContextValue {
  /** Play the sign-in ignition, then route to `redirectTo` once it has
   *  fully covered the screen (so the destination mounts unseen). */
  play: (redirectTo: string) => void;
}

const WelcomeContext = createContext<WelcomeContextValue | undefined>(undefined);

/**
 * Owns the sign-in hand-off overlay. It lives above the route outlet, so it
 * survives the login → home navigation: it fades in over the auth screen,
 * routes underneath while opaque, then dissolves to reveal a loaded home.
 */
export function WelcomeProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [active, setActive] = useState(false);
  const targetRef = useRef<string>("/home");

  const play = useCallback((redirectTo: string) => {
    targetRef.current = redirectTo;
    setActive(true);
  }, []);

  const navigate = useCallback(() => {
    router.replace(targetRef.current);
  }, [router]);

  const dismiss = useCallback(() => setActive(false), []);

  return (
    <WelcomeContext.Provider value={{ play }}>
      {children}
      {active ? (
        <CinematicWelcome onCovered={navigate} onDone={dismiss} />
      ) : null}
    </WelcomeContext.Provider>
  );
}

export function useWelcome() {
  const ctx = useContext(WelcomeContext);
  if (!ctx) {
    throw new Error("useWelcome must be used within a WelcomeProvider");
  }
  return ctx;
}
