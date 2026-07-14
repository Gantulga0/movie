"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import { ProfilePanel } from "./ProfilePanel";
import { DetailsModalProvider } from "@/components/details/DetailsModalProvider";

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
    <DetailsModalProvider>
      <div className="min-h-screen bg-background">
      {/* useSearchParams inside Sidebar needs a Suspense boundary. */}
      <Suspense fallback={null}>
        <Sidebar expanded={expanded} onToggle={toggle} onProfile={openProfile} />
      </Suspense>

      {/* Mobile top bar — brand only; navigation lives at the bottom. */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-background-deep/85 px-5 backdrop-blur-md md:hidden">
        <Link
          href="/home"
          className="display select-none text-xl font-bold tracking-tight"
          aria-label="Infinite нүүр хуудас"
        >
          <span className="text-accent">∞</span>{" "}
          <span className="text-foreground">INFINITE</span>
        </Link>
      </header>

      <main
        className={`pb-20 transition-[padding] duration-200 md:pb-0 ${
          expanded ? "md:pl-60" : "md:pl-[72px]"
        }`}
      >
        {children}
      </main>

      <MobileNav onProfile={openProfile} />
      <ProfilePanel open={profileOpen} onClose={closeProfile} />
      </div>
    </DetailsModalProvider>
  );
}
