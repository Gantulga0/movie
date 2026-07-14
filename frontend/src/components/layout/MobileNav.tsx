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

/** Bottom navigation on small screens; profile opens the account sheet. */
export function MobileNav({ onProfile }: { onProfile: () => void }) {
  const pathname = usePathname();
  const { user } = useAuth();

  return (
    <nav
      aria-label="Үндсэн цэс"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-background-deep/90 backdrop-blur-md md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid grid-cols-5">
        {ITEMS.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold transition ${
                active ? "text-accent" : "text-muted"
              }`}
            >
              <Icon size={21} />
              {item.label}
            </Link>
          );
        })}

        <button
          type="button"
          onClick={onProfile}
          className="flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold text-muted"
        >
          {user?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatarUrl}
              alt=""
              className="h-[21px] w-[21px] rounded-full border border-line-strong object-cover"
            />
          ) : (
            <span className="grid h-[21px] w-[21px] place-items-center rounded-full bg-accent/20 text-[10px] font-bold text-accent">
              {(user?.name?.[0] ?? user?.phone?.[0] ?? "?").toUpperCase()}
            </span>
          )}
          Профайл
        </button>
      </div>
    </nav>
  );
}
