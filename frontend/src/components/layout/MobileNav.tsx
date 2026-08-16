"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  IconBookmark,
  IconCompass,
  IconHome,
  IconSearch,
  IconSettings,
} from "@/components/ui/icons";

const ITEMS = [
  { href: "/home", label: "Нүүр", icon: IconHome },
  { href: "/search", label: "Хайх", icon: IconSearch },
  { href: "/browse", label: "Ангилал", icon: IconCompass },
  { href: "/my-list", label: "Жагсаалт", icon: IconBookmark },
  { href: "/settings", label: "Тохиргоо", icon: IconSettings },
];

/**
 * Bottom dock on phones: a solid near-black bar, icon-only, with a glowing
 * indicator bar under the active destination. Labels live in aria-labels.
 */
export function MobileNav({ onProfile }: { onProfile: () => void }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const navItems =
    user?.role === "ADMIN"
      ? [...ITEMS, { href: "/admin", label: "Админ", icon: IconSettings }]
      : ITEMS;

  return (
    <nav
      aria-label="Үндсэн цэс"
      className="fixed inset-x-0 bottom-0 z-40 bg-background-deep md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* iOS toolbar transitions can expose a strip below the dock —
          keep that zone painted the same black. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-full h-40 bg-background-deep"
      />
      <div
        className={`grid px-2 pb-2 pt-3 ${
          user?.role === "ADMIN" ? "grid-cols-6" : "grid-cols-5"
        }`}
      >
        {navItems.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className="flex flex-col items-center gap-1.5 py-1"
            >
              <Icon
                size={24}
                className={`icon-live transition-colors ${
                  active ? "text-accent" : "text-muted"
                }`}
              />
              <span
                aria-hidden
                className={`h-1 w-7 rounded-full transition ${
                  active
                    ? "bg-accent shadow-[0_0_8px_rgba(124,140,255,0.8)]"
                    : "bg-transparent"
                }`}
              />
            </Link>
          );
        })}

        <button
          type="button"
          onClick={onProfile}
          aria-label="Профайл"
          className="flex flex-col items-center gap-1.5 py-1"
        >
          {user?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatarUrl}
              alt=""
              className="h-6 w-6 rounded-full border border-line-strong object-cover"
            />
          ) : (
            <span className="grid h-6 w-6 place-items-center rounded-full bg-accent/20 text-[11px] font-bold text-accent">
              {(user?.name?.[0] ?? user?.phone?.[0] ?? "?").toUpperCase()}
            </span>
          )}
          <span aria-hidden className="h-1 w-7 rounded-full bg-transparent" />
        </button>
      </div>
    </nav>
  );
}
