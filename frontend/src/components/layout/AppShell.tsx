"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  // Home is immersive on phones: the hero runs edge-to-edge under a
  // transparent gradient header instead of sitting below a solid bar.
  // Once the page scrolls, the scrim solidifies so passing content
  // never shows through the brand row.
  const immersive = pathname === "/home";
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
          the safe-area padding keeps it over the notch/status bar. On home
          it becomes a scrim so the hero artwork shows through. */}
      <header
        className={`fixed inset-x-0 top-0 z-40 transition-colors duration-300 md:hidden ${
          immersive && !scrolled
            ? "bg-gradient-to-b from-background-deep/90 via-background-deep/40 to-transparent"
            : "border-b border-line bg-background-deep/90 backdrop-blur-md"
        }`}
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
        className={`pb-20 transition-[padding] duration-200 md:pb-0 md:pt-0 ${
          immersive ? "pt-0" : "pt-[calc(3.5rem+env(safe-area-inset-top))]"
        } ${expanded ? "md:pl-60" : "md:pl-[72px]"}`}
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
