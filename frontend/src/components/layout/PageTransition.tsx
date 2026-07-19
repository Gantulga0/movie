"use client";

import { usePathname } from "next/navigation";

/**
 * Route-change entrance: remounting on every pathname change replays the
 * rise-into-the-light animation, so each page arrives like a new scene.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="page-enter">
      {children}
    </div>
  );
}
