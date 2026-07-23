"use client";

import { useLayoutEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  IconBookmark,
  IconChevronRight,
  IconClapperboard,
  IconHome,
  IconSearch,
  IconSeriesPlay,
  IconSettings,
  IconSparkle,
  IconTicket,
} from "@/components/ui/icons";

export interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
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
    icon: IconClapperboard,
    query: { key: "type", value: "MOVIE" },
  },
  {
    href: "/browse?type=SERIES",
    label: "Цуврал",
    icon: IconSeriesPlay,
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
 * Desktop navigation rail: layered glass lit by an indigo aurora at the
 * brand, a collapse handle riding the outer edge, and one projector
 * light-bar that glides to the active item.
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
  }, [pathname, params, user, expanded]);

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
      className={`fixed inset-y-0 left-0 z-40 hidden flex-col transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] md:flex ${
        expanded ? "w-60" : "w-[72px]"
      }`}
    >
      {/* Layered glass backdrop: aurora at the brand, lit right edge. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 border-r border-line bg-background-deep/80 backdrop-blur-xl"
      />
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 -z-10 h-44"
        style={{
          background:
            "radial-gradient(80% 65% at 50% 0%, rgba(124,140,255,0.16), transparent 72%)",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-y-0 right-0 -z-10 w-px bg-gradient-to-b from-transparent via-accent/25 to-transparent"
      />

      {/* The gliding light-bar */}
      <span
        ref={beamRef}
        aria-hidden
        className="absolute left-0 z-10 h-6 w-[3px] rounded-r-full bg-accent opacity-0 shadow-[0_0_12px_rgba(124,140,255,0.8)] transition-[top,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
      />

      {/* Collapse handle riding the rail's outer edge */}
      <button
        type="button"
        onClick={onToggle}
        aria-label={expanded ? "Цэс хумих" : "Цэс дэлгэх"}
        aria-expanded={expanded}
        className="absolute -right-3 top-[76px] z-20 grid h-6 w-6 place-items-center rounded-full border border-line-strong bg-surface-raised text-muted shadow-card transition hover:border-accent/60 hover:text-foreground hover:shadow-[0_0_12px_rgba(124,140,255,0.4)]"
      >
        <IconChevronRight
          size={13}
          className={`transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {/* Brand */}
      <div
        className={`flex h-20 shrink-0 items-center ${expanded ? "px-5" : "justify-center"}`}
      >
        <Link
          href="/home"
          className="group flex select-none items-center gap-2.5"
          aria-label="Infinite нүүр хуудас"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/infinity.png"
            alt=""
            className="h-8 w-auto shrink-0 drop-shadow-[0_0_14px_rgba(124,140,255,0.55)] transition duration-300 group-hover:drop-shadow-[0_0_22px_rgba(124,140,255,0.8)]"
          />
          {expanded ? (
            <span className="sidebar-label display text-2xl font-bold tracking-tight text-foreground">
              INFINITE
            </span>
          ) : null}
        </Link>
      </div>

      {/* Main items. Clip long labels only while expanded; when collapsed the
          container must stay overflow-visible so the hover tooltips (which sit
          at left-full, outside the 72px rail) aren't clipped away. */}
      <div
        className={`flex flex-1 flex-col gap-1 px-3 py-2 ${
          expanded ? "overflow-hidden" : "overflow-visible"
        }`}
      >
        {expanded ? (
          <p className="sidebar-label mb-1 px-3 text-[10px] font-bold uppercase tracking-[0.28em] text-muted/70">
            Цэс
          </p>
        ) : null}
        {MAIN_ITEMS.map((item) => (
          <SidebarLink
            key={item.href}
            item={item}
            active={isActive(item)}
            expanded={expanded}
          />
        ))}

        {expanded ? (
          <p className="sidebar-label mb-1 mt-4 px-3 text-[10px] font-bold uppercase tracking-[0.28em] text-muted/70">
            Гишүүнчлэл
          </p>
        ) : (
          <div className="mx-auto my-2 h-px w-8 bg-line" aria-hidden />
        )}

        {/* Upgrade CTA: a lit gradient pill */}
        <Link
          href="/plans"
          aria-current={pathname === "/plans" ? "page" : undefined}
          className="group relative rounded-xl bg-gradient-to-r from-accent-strong/70 via-accent/45 to-accent-strong/70 p-px shadow-[0_2px_16px_rgba(93,110,245,0.25)] transition hover:shadow-[0_2px_24px_rgba(93,110,245,0.45)]"
        >
          <span
            className={`flex items-center gap-3 rounded-[11px] py-2 text-sm font-semibold transition-colors ${
              pathname === "/plans"
                ? "bg-accent/[.18] text-foreground"
                : "bg-background-deep/85 text-accent group-hover:bg-background-deep/60 group-hover:text-foreground"
            } ${expanded ? "px-3" : "justify-center px-0"}`}
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center">
              <IconSparkle size={20} className="icon-live" />
            </span>
            {expanded ? (
              <span className="sidebar-label truncate">Эрх сунгах</span>
            ) : (
              <Tooltip label="Эрх сунгах" />
            )}
          </span>
        </Link>
      </div>

      {/* Bottom cluster */}
      <div className="flex shrink-0 flex-col gap-1 border-t border-line/70 px-3 py-3">
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
          className={`group relative flex items-center gap-3 rounded-xl py-2 text-left transition hover:bg-white/[.06] active:scale-[0.98] ${
            expanded ? "px-2.5" : "justify-center px-0"
          }`}
        >
          <span className="shrink-0 rounded-full bg-gradient-to-br from-accent/70 via-accent/25 to-transparent p-[2px] transition duration-300 group-hover:from-accent group-hover:via-accent/50">
            <Avatar user={user} />
          </span>
          {expanded ? (
            <span className="sidebar-label min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-foreground/90">
                {user?.name ?? user?.phone ?? "Профайл"}
              </span>
              <span className="block text-[11px] text-muted">
                Профайл харах
              </span>
            </span>
          ) : (
            <Tooltip label="Профайл" />
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
}: {
  item: NavItem;
  active: boolean;
  expanded: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`group relative flex items-center gap-3 rounded-xl py-2 text-sm font-semibold transition-colors duration-200 active:scale-[0.98] ${
        expanded ? "px-3" : "justify-center px-0"
      } ${
        active
          ? "text-foreground"
          : "text-muted hover:bg-white/[.05] hover:text-foreground"
      }`}
    >
      {/* Lit chip behind the active item */}
      {active ? (
        <span
          aria-hidden
          className="absolute inset-0 rounded-xl bg-gradient-to-r from-accent/[.22] to-accent/[.04] shadow-[inset_0_1px_0_rgba(124,140,255,0.22)]"
        />
      ) : null}
      <span
        className={`relative grid h-8 w-8 shrink-0 place-items-center ${
          active
            ? "text-accent drop-shadow-[0_0_8px_rgba(124,140,255,0.75)]"
            : ""
        }`}
      >
        <Icon size={21} className="icon-live" />
      </span>
      {expanded ? (
        <span className="sidebar-label relative truncate">{item.label}</span>
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
      className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg border border-line bg-surface-raised px-2.5 py-1.5 text-xs font-semibold text-foreground opacity-0 shadow-card transition-all duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
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
        className="block h-8 w-8 rounded-full object-cover"
      />
    );
  }
  return (
    <span className="grid h-8 w-8 place-items-center rounded-full bg-surface-overlay text-sm font-bold text-accent">
      {(user?.name?.[0] ?? user?.phone?.[0] ?? "?").toUpperCase()}
    </span>
  );
}
