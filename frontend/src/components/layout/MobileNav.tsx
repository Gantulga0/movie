"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  IconBookmark,
  IconCompass,
  IconHome,
  IconSearch,
} from "@/components/ui/icons";

const ITEMS = [
  { href: "/home", label: "Нүүр", icon: IconHome },
  { href: "/search", label: "Хайх", icon: IconSearch },
  { href: "/browse", label: "Ангилал", icon: IconCompass },
  { href: "/my-list", label: "Жагсаалт", icon: IconBookmark },
];

/**
 * Bottom dock on phones: a solid near-black bar, icon-only, with a glowing
 * indicator bar under the active destination. Labels live in aria-labels.
 */
export function MobileNav({ onProfile }: { onProfile: () => void }) {
  const pathname = usePathname();
  const { user } = useAuth();

  return (
    <nav
      aria-label="Үндсэн цэс"
      className="fixed inset-x-0 bottom-0 z-40 bg-background-deep md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid grid-cols-5 px-2 pb-2 pt-3">
        {ITEMS.map((item) => {
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
