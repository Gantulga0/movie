"use client";

import { useLayoutEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  IconBookmark,
  IconChevronLeft,
  IconChevronRight,
  IconFilm,
  IconHome,
  IconRenew,
  IconSearch,
  IconSettings,
  IconTicket,
  IconTv,
} from "@/components/ui/icons";

export interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  /** Marks active when pathname matches and this query is present. */
  query?: { key: string; value: string };
  /** Active only on exact pathname + no filter query. */
  exactQuery?: boolean;
}

const MAIN_ITEMS: NavItem[] = [
  { href: "/home", label: "Нүүр", icon: IconHome },
  { href: "/search", label: "Хайх", icon: IconSearch },
  {
    href: "/browse?type=MOVIE",
    label: "Кино",
    icon: IconFilm,
    query: { key: "type", value: "MOVIE" },
  },
  {
    href: "/browse?type=SERIES",
    label: "Цуврал",
    icon: IconTv,
    query: { key: "type", value: "SERIES" },
  },
  { href: "/my-list", label: "Миний жагсаалт", icon: IconBookmark },
  { href: "/rentals", label: "Түрээс", icon: IconTicket },
];

interface SidebarProps {
  expanded: boolean;
  onToggle: () => void;
  onProfile: () => void;
}

/**
 * Desktop navigation rail. Compact (icons + hover tooltips) by default,
 * expands to full labels. The active item carries a thin light-bar — the
 * projector beam motif.
 */
export function Sidebar({ expanded, onToggle, onProfile }: SidebarProps) {
  const pathname = usePathname();
  const params = useSearchParams();
  const { user } = useAuth();
  const navRef = useRef<HTMLElement>(null);

  // Projector beam: one light-bar that glides to the active item.
  // Positioned by direct style mutation — pure measurement, no re-render.
  const beamRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const nav = navRef.current;
    const beam = beamRef.current;
    if (!nav || !beam) return;
    const active = nav.querySelector<HTMLElement>('a[aria-current="page"]');
    if (!active) {
      beam.style.opacity = "0";
      return;
    }
    const navRect = nav.getBoundingClientRect();
    const rect = active.getBoundingClientRect();
    beam.style.top = `${rect.top - navRect.top + (rect.height - 24) / 2}px`;
    beam.style.opacity = "1";
  }, [pathname, params, user]);

  function isActive(item: NavItem): boolean {
    const [path] = item.href.split("?");
    if (pathname !== path) return false;
    if (item.query) return params.get(item.query.key) === item.query.value;
    if (item.exactQuery) return !params.get("type");
    return true;
  }

  return (
    <nav
      ref={navRef}
      aria-label="Үндсэн цэс"
      className={`fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-line bg-background-deep/85 backdrop-blur-md transition-[width] duration-200 md:flex ${
        expanded ? "w-60" : "w-[72px]"
      }`}
    >
      <span
        ref={beamRef}
        aria-hidden
        className="absolute left-0 z-10 h-6 w-[3px] rounded-r-full bg-accent opacity-0 shadow-[0_0_12px_rgba(124,140,255,0.8)] transition-[top,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
      />
      {/* Brand */}
      <div className={`flex h-16 items-center ${expanded ? "px-5" : "justify-center"}`}>
        <Link
          href="/home"
          className="display flex select-none items-center gap-1 text-xl font-bold tracking-tight"
          aria-label="Infinite нүүр хуудас"
        >
          <span className="text-accent">∞</span>
          {expanded ? <span className="text-foreground">INFINITE</span> : null}
        </Link>
      </div>

      {/* Main items */}
      <div className="flex flex-1 flex-col gap-1 px-3 py-2">
        {MAIN_ITEMS.map((item) => (
          <SidebarLink
            key={item.href}
            item={item}
            active={isActive(item)}
            expanded={expanded}
          />
        ))}

        <div className="mx-2 my-2 h-px bg-line" aria-hidden />

        <SidebarLink
          item={{ href: "/plans", label: "Эрх сунгах", icon: IconRenew }}
          active={pathname === "/plans"}
          expanded={expanded}
          accent
        />
      </div>

      {/* Bottom cluster */}
      <div className="flex flex-col gap-1 border-t border-line px-3 py-3">
        {user?.role === "ADMIN" ? (
          <SidebarLink
            item={{ href: "/admin", label: "Админ самбар", icon: IconSettings }}
            active={pathname.startsWith("/admin")}
            expanded={expanded}
          />
        ) : null}

        <button
          type="button"
          onClick={onProfile}
          className={`group relative flex items-center gap-3 rounded-xl py-2 text-sm font-semibold text-muted transition hover:bg-white/[.06] hover:text-foreground ${
            expanded ? "px-3" : "justify-center px-0"
          }`}
        >
          <Avatar user={user} />
          {expanded ? (
            <span className="min-w-0 flex-1 truncate text-left">
              {user?.name ?? user?.phone ?? "Профайл"}
            </span>
          ) : (
            <Tooltip label="Профайл" />
          )}
        </button>

        <button
          type="button"
          onClick={onToggle}
          aria-label={expanded ? "Цэс хумих" : "Цэс дэлгэх"}
          aria-expanded={expanded}
          className={`group relative flex items-center gap-3 rounded-xl py-2 text-muted transition hover:bg-white/[.06] hover:text-foreground ${
            expanded ? "px-3" : "justify-center px-0"
          }`}
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center">
            {expanded ? <IconChevronLeft /> : <IconChevronRight />}
          </span>
          {expanded ? (
            <span className="text-sm font-semibold">Хумих</span>
          ) : (
            <Tooltip label="Цэс дэлгэх" />
          )}
        </button>
      </div>
    </nav>
  );
}

function SidebarLink({
  item,
  active,
  expanded,
  accent = false,
}: {
  item: NavItem;
  active: boolean;
  expanded: boolean;
  accent?: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`group relative flex items-center gap-3 rounded-xl py-2 text-sm font-semibold transition ${
        expanded ? "px-3" : "justify-center px-0"
      } ${
        active
          ? "bg-accent/[.13] text-foreground"
          : accent
            ? "text-accent hover:bg-accent/[.09]"
            : "text-muted hover:bg-white/[.06] hover:text-foreground"
      }`}
    >
      <span
        className={`grid h-8 w-8 shrink-0 place-items-center ${active ? "text-accent" : ""}`}
      >
        <Icon size={21} />
      </span>
      {expanded ? (
        <span className="truncate">{item.label}</span>
      ) : (
        <Tooltip label={item.label} />
      )}
    </Link>
  );
}

/** Compact-state tooltip, revealed on hover or keyboard focus. */
function Tooltip({ label }: { label: string }) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg border border-line bg-surface-raised px-2.5 py-1.5 text-xs font-semibold text-foreground opacity-0 shadow-card transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
    >
      {label}
    </span>
  );
}

function Avatar({
  user,
}: {
  user: { name: string | null; phone: string; avatarUrl: string | null } | null;
}) {
  if (user?.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.avatarUrl}
        alt=""
        className="h-8 w-8 shrink-0 rounded-full border border-line-strong object-cover"
      />
    );
  }
  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent/20 text-sm font-bold text-accent">
      {(user?.name?.[0] ?? user?.phone?.[0] ?? "?").toUpperCase()}
    </span>
  );
}
