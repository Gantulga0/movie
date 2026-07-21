"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import { ProfilePanel } from "./ProfilePanel";
import { DetailsModalProvider } from "@/components/details/DetailsModalProvider";
import { PageTransition } from "./PageTransition";
import { SubscriptionProvider } from "@/lib/subscription-context";

const SIDEBAR_KEY = "infinity_sidebar_expanded";

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

  // Home's hero runs under the status bar; every other page keeps its
  // content clear of it.
  const immersive = pathname === "/home";

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
      {/* The app owns exactly one viewport-sized box and scrolls inside it.
          The document itself never scrolls, so iOS Safari's toolbar never
          collapses and fixed bars can never lag or expose content strips. */}
      <div className="h-dvh overflow-hidden bg-background">
      {/* useSearchParams inside Sidebar needs a Suspense boundary. */}
      <Suspense fallback={null}>
        <Sidebar expanded={expanded} onToggle={toggle} onProfile={openProfile} />
      </Suspense>

      {/* Phones have no top bar at all — content owns the whole screen;
          navigation lives in the solid bottom dock. */}
      <div className="h-full overflow-y-auto overscroll-contain">
        <main
          className={`pb-24 transition-[padding] duration-200 md:pb-0 md:pt-0 ${
            immersive ? "" : "pt-[env(safe-area-inset-top)]"
          } ${expanded ? "md:pl-60" : "md:pl-[72px]"}`}
        >
          <PageTransition>{children}</PageTransition>
        </main>
      </div>

      <MobileNav onProfile={openProfile} />
      <ProfilePanel open={profileOpen} onClose={closeProfile} />
      </div>
    </DetailsModalProvider>
    </SubscriptionProvider>
  );
}
