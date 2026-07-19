"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useSubscription } from "@/lib/subscription-context";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  IconChevronRight,
  IconFileText,
  IconHelp,
  IconLogOut,
  IconRenew,
  IconSparkle,
  IconUser,
  IconX,
} from "@/components/ui/icons";
import { daysLeft, formatDate, remainingPercent } from "@/lib/format";

interface ProfilePanelProps {
  open: boolean;
  onClose: () => void;
}

/** Left-hand account sheet (slides out beside the sidebar): identity, subscription state, quick links. */
export function ProfilePanel({ open, onClose }: ProfilePanelProps) {
  const router = useRouter();
  const { user, logout } = useAuth();
  // Subscription state is served from the app-wide cache — the sheet opens
  // instantly; a silent refresh keeps it honest.
  const { subscription: active, loading, refresh } = useSubscription();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    void refresh();
  }, [open, refresh]);

  // Esc close + scroll lock.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    const frame = requestAnimationFrame(() => panelRef.current?.focus());
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open || !user) return null;

  const remaining = active ? daysLeft(active.endsAt) : 0;
  const remainingPct = active
    ? remainingPercent(active.startedAt, active.endsAt)
    : 0;

  return (
    <div
      className="fixed inset-0 z-50 bg-background-deep/70 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Миний бүртгэл"
        tabIndex={-1}
        className="animate-slide-right fixed left-0 top-0 flex h-dvh w-full flex-col overflow-y-auto overscroll-contain bg-background-deep shadow-pop outline-none sm:max-w-sm sm:border-r sm:border-line sm:bg-surface"
      >
        {/* iOS viewport transitions can expose strips beyond the sheet —
            keep those zones painted the same black. */}
        <span
          aria-hidden
          className="pointer-events-none fixed inset-x-0 bottom-full h-40 bg-background-deep sm:hidden"
        />
        <span
          aria-hidden
          className="pointer-events-none fixed inset-x-0 top-full h-40 bg-background-deep sm:hidden"
        />
        {/* Identity */}
        <div className="projector-light relative border-b border-line px-6 pb-6 pt-5">
          <button
            type="button"
            onClick={onClose}
            aria-label="Хаах"
            className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full border border-line bg-white/[.04] text-muted transition duration-200 hover:rotate-90 hover:border-line-strong hover:bg-white/10 hover:text-foreground"
          >
            <IconX size={16} />
          </button>

          <div className="mt-4 flex items-center gap-4">
            <span className="shrink-0 rounded-full bg-gradient-to-br from-accent/70 via-accent/25 to-transparent p-[2px]">
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatarUrl}
                  alt=""
                  className="block h-16 w-16 rounded-full object-cover"
                />
              ) : (
                <span className="grid h-16 w-16 place-items-center rounded-full bg-surface-overlay text-2xl font-bold text-accent">
                  {(user.name?.[0] ?? user.phone[0]).toUpperCase()}
                </span>
              )}
            </span>
            <div className="min-w-0">
              <p className="truncate text-lg font-bold text-foreground">
                {user.name ?? user.phone}
              </p>
              <p className="mt-0.5 text-sm text-muted">
                Гишүүний ID:{" "}
                <span className="font-semibold tracking-wider text-gold">
                  USER-{user.publicId}
                </span>
              </p>
              <p className="mt-0.5 truncate text-xs text-muted">
                {user.email ?? user.phone}
              </p>
            </div>
          </div>
        </div>

        {/* Subscription state — the membership pass */}
        <div className="border-b border-line px-6 py-5">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted">
            Эрхийн байдал
          </p>
          {loading && !active ? (
            <Skeleton className="mt-3 h-40 rounded-2xl" />
          ) : active ? (
            <div className="relative mt-3 overflow-hidden rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/[.16] via-surface-raised/70 to-surface-raised/40 p-4 shadow-[inset_0_1px_0_rgba(124,140,255,0.18)]">
              {/* Ambient light + brand watermark */}
              <div
                aria-hidden
                className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-accent/25 blur-3xl"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/infinity.png"
                alt=""
                aria-hidden
                className="pointer-events-none absolute -bottom-3 -right-2 h-16 w-auto opacity-[.12]"
              />

              <div className="flex items-center justify-between">
                <p className="display text-lg font-semibold text-foreground">
                  {active.plan.name}
                </p>
                <Badge tone="success">Идэвхтэй</Badge>
              </div>

              <p className="mt-2 flex items-baseline gap-1.5">
                <span className="display text-4xl font-bold tabular-nums text-foreground">
                  {remaining}
                </span>
                <span className="text-sm font-medium text-muted">
                  хоног үлдсэн
                </span>
              </p>

              {/* Time-remaining beam */}
              <div
                className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[.08]"
                role="progressbar"
                aria-label="Эрхийн үлдсэн хугацаа"
                aria-valuenow={remainingPct}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-accent-strong to-accent shadow-[0_0_10px_rgba(124,140,255,0.7)] transition-[width] duration-500"
                  style={{ width: `${remainingPct}%` }}
                />
              </div>

              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-muted">
                  Идэвхжсэн{" "}
                  <span className="font-semibold text-foreground/80">
                    {formatDate(active.startedAt)}
                  </span>
                </span>
                <span className="text-muted">
                  Дуусах{" "}
                  <span className="font-semibold text-foreground/80">
                    {formatDate(active.endsAt)}
                  </span>
                </span>
              </div>
            </div>
          ) : (
            <div className="mt-3 rounded-2xl border border-dashed border-line-strong bg-surface-raised/40 p-5 text-center">
              <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-accent/15 text-accent">
                <IconSparkle size={20} />
              </span>
              <p className="mt-2.5 text-sm font-bold text-foreground">
                Идэвхтэй багц алга
              </p>
              <p className="mx-auto mt-1 max-w-[240px] text-xs leading-relaxed text-muted">
                Багц идэвхжүүлээд бүх кино, цувралыг хязгааргүй үзээрэй.
              </p>
            </div>
          )}
          <Link
            href="/plans"
            onClick={onClose}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-accent-strong py-2.5 text-sm font-bold text-white shadow-[0_4px_20px_rgba(93,110,245,0.3)] transition hover:bg-accent active:scale-[0.98]"
          >
            <IconRenew size={17} />
            {active ? "Эрх сунгах" : "Багц идэвхжүүлэх"}
          </Link>
        </div>

        {/* Account */}
        <div className="flex-1 px-3 py-3">
          <p className="px-4 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-[0.28em] text-muted/70">
            Бүртгэл
          </p>
          <PanelLink
            href="/account"
            onClick={onClose}
            icon={<IconUser size={19} className="icon-live" />}
          >
            Профайл засах
          </PanelLink>

          <p className="px-4 pb-1 pt-4 text-[10px] font-bold uppercase tracking-[0.28em] text-muted/70">
            Тусламж
          </p>
          <PanelLink
            href="/faq"
            onClick={onClose}
            icon={<IconHelp size={19} className="icon-live" />}
          >
            Түгээмэл асуултууд
          </PanelLink>
          <PanelLink
            href="/terms"
            onClick={onClose}
            icon={<IconFileText size={19} className="icon-live" />}
          >
            Үйлчилгээний нөхцөл
          </PanelLink>
        </div>

        {/* Logout */}
        <div className="border-t border-line px-3 py-3">
          <button
            type="button"
            onClick={async () => {
              await logout();
              router.replace("/login");
            }}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-danger transition hover:bg-danger/10 active:scale-[0.98]"
          >
            <IconLogOut size={19} className="icon-live" />
            Гарах
          </button>
        </div>
      </div>
    </div>
  );
}

function PanelLink({
  href,
  onClick,
  icon,
  children,
}: {
  href: string;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-foreground/85 transition hover:bg-white/[.06] hover:text-foreground active:scale-[0.99]"
    >
      <span className="text-muted transition-colors group-hover:text-accent">
        {icon}
      </span>
      <span className="flex-1">{children}</span>
      <IconChevronRight
        size={15}
        className="text-muted/40 transition group-hover:translate-x-0.5 group-hover:text-muted"
      />
    </Link>
  );
}
