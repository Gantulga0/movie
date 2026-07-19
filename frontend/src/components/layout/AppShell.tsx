"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import { ProfilePanel } from "./ProfilePanel";
import { DetailsModalProvider } from "@/components/details/DetailsModalProvider";
import { PageTransition } from "./PageTransition";
import { SubscriptionProvider } from "@/lib/subscription-context";

const SIDEBAR_KEY = "mnflix_sidebar_expanded";

/**
 * Signed-in chrome: auth guard, desktop sidebar (compact by default),
 * mobile top bar + bottom navigation, and the profile sheet.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  // Unauthenticated visitors are sent to login.
  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  // Restore the saved sidebar preference after mount (avoids hydration drift).
  useEffect(() => {
    queueMicrotask(() =>
      setExpanded(localStorage.getItem(SIDEBAR_KEY) === "1"),
    );
  }, []);

  const toggle = useCallback(() => {
    setExpanded((v) => {
      localStorage.setItem(SIDEBAR_KEY, v ? "0" : "1");
      return !v;
    });
  }, []);

  const openProfile = useCallback(() => setProfileOpen(true), []);
  const closeProfile = useCallback(() => setProfileOpen(false), []);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div
          aria-label="Ачаалж байна"
          className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-accent"
        />
      </div>
    );
  }

  return (
    <SubscriptionProvider>
    <DetailsModalProvider>
      <div className="min-h-screen bg-background">
      {/* useSearchParams inside Sidebar needs a Suspense boundary. */}
      <Suspense fallback={null}>
        <Sidebar expanded={expanded} onToggle={toggle} onProfile={openProfile} />
      </Suspense>

      {/* Mobile top bar — fixed so page content can never surface above it;
          the safe-area padding keeps its glass over the notch/status bar. */}
      <header
        className="fixed inset-x-0 top-0 z-40 border-b border-line bg-background-deep/85 backdrop-blur-md md:hidden"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="flex h-14 items-center px-5">
          <Link
            href="/home"
            className="flex select-none items-center gap-2.5"
            aria-label="Infinite нүүр хуудас"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/infinity.png"
              alt=""
              className="h-8 w-auto drop-shadow-[0_0_14px_rgba(124,140,255,0.55)]"
            />
            <span className="display text-2xl font-bold tracking-tight text-foreground">
              INFINITE
            </span>
          </Link>
        </div>
      </header>

      <main
        className={`pb-20 pt-[calc(3.5rem+env(safe-area-inset-top))] transition-[padding] duration-200 md:pb-0 md:pt-0 ${
          expanded ? "md:pl-60" : "md:pl-[72px]"
        }`}
      >
        <PageTransition>{children}</PageTransition>
      </main>

      <MobileNav onProfile={openProfile} />
      <ProfilePanel open={profileOpen} onClose={closeProfile} />
      </div>
    </DetailsModalProvider>
    </SubscriptionProvider>
  );
}
