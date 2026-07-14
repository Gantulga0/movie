"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { billingApi } from "@/lib/api";
import type { MySubscription } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  IconCreditCard,
  IconLogOut,
  IconRenew,
  IconSettings,
  IconTicket,
  IconUser,
  IconX,
} from "@/components/ui/icons";
import { daysLeft, formatDate } from "@/lib/format";

interface ProfilePanelProps {
  open: boolean;
  onClose: () => void;
}

/** Left-hand account sheet (slides out beside the sidebar): identity, subscription state, quick links. */
export function ProfilePanel({ open, onClose }: ProfilePanelProps) {
  const router = useRouter();
  const { user, token, logout } = useAuth();
  const [mine, setMine] = useState<MySubscription | null>(null);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Fresh subscription state every time the sheet opens.
  useEffect(() => {
    if (!open || !token) return;
    queueMicrotask(() => setLoading(true));
    billingApi
      .me(token)
      .then(setMine)
      .catch(() => setMine(null))
      .finally(() => setLoading(false));
  }, [open, token]);

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

  const active = mine?.active ?? null;
  const remaining = active ? daysLeft(active.endsAt) : 0;

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
        className="animate-slide-right fixed inset-y-0 left-0 flex w-full max-w-sm flex-col overflow-y-auto border-r border-line bg-surface shadow-pop outline-none"
      >
        {/* Identity */}
        <div className="projector-light relative border-b border-line px-6 pb-6 pt-5">
          <button
            type="button"
            onClick={onClose}
            aria-label="Хаах"
            className="absolute right-4 top-4 rounded-full p-2 text-muted transition hover:bg-white/10 hover:text-foreground"
          >
            <IconX size={18} />
          </button>

          <div className="mt-4 flex items-center gap-4">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatarUrl}
                alt=""
                className="h-16 w-16 rounded-full border border-line-strong object-cover"
              />
            ) : (
              <span className="grid h-16 w-16 place-items-center rounded-full bg-accent/20 text-2xl font-bold text-accent">
                {(user.name?.[0] ?? user.phone[0]).toUpperCase()}
              </span>
            )}
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

        {/* Subscription state */}
        <div className="border-b border-line px-6 py-5">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted">
            Эрхийн байдал
          </p>
          {loading ? (
            <div className="mt-3 space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-56" />
            </div>
          ) : active ? (
            <div className="mt-3">
              <div className="flex items-center justify-between">
                <p className="text-base font-bold text-foreground">
                  {active.plan.name}
                </p>
                <Badge tone="success">Идэвхтэй</Badge>
              </div>
              <dl className="mt-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted">Идэвхжсэн</dt>
                  <dd className="text-foreground">{formatDate(active.startedAt)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Дуусах</dt>
                  <dd className="text-foreground">{formatDate(active.endsAt)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Үлдсэн</dt>
                  <dd className="font-semibold text-accent">{remaining} хоног</dd>
                </div>
              </dl>
            </div>
          ) : (
            <div className="mt-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted">Идэвхтэй багц алга</p>
                <Badge tone="danger">Идэвхгүй</Badge>
              </div>
            </div>
          )}
          <Link
            href="/plans"
            onClick={onClose}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-accent-strong py-2.5 text-sm font-bold text-white transition hover:bg-accent"
          >
            <IconRenew size={17} />
            {active ? "Эрх сунгах" : "Багц идэвхжүүлэх"}
          </Link>
        </div>

        {/* Links */}
        <div className="flex-1 px-3 py-3">
          <PanelLink href="/account" onClick={onClose} icon={<IconUser size={19} />}>
            Профайл засах
          </PanelLink>
          <PanelLink href="/rentals" onClick={onClose} icon={<IconTicket size={19} />}>
            Миний түрээс
          </PanelLink>
          <PanelLink
            href="/plans"
            onClick={onClose}
            icon={<IconCreditCard size={19} />}
          >
            Багц, төлбөрийн түүх
          </PanelLink>
          {user.role === "ADMIN" ? (
            <PanelLink
              href="/admin"
              onClick={onClose}
              icon={<IconSettings size={19} />}
            >
              Админ самбар
            </PanelLink>
          ) : null}
        </div>

        {/* Logout */}
        <div className="border-t border-line px-3 py-3">
          <button
            type="button"
            onClick={async () => {
              await logout();
              router.replace("/login");
            }}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-danger transition hover:bg-danger/10"
          >
            <IconLogOut size={19} />
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
      className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-foreground/85 transition hover:bg-white/[.06] hover:text-foreground"
    >
      <span className="text-muted">{icon}</span>
      {children}
    </Link>
  );
}
