"use client";

import { useEffect, useState } from "react";
import { billingApi } from "@/lib/api";
import type { ContentAccess, Plan } from "@/lib/types";
import { Button, ButtonLink } from "@/components/ui/Button";
import { IconSparkle, IconTicket } from "@/components/ui/icons";
import { formatHours, formatMnt } from "@/lib/format";

interface AccessOptionsProps {
  /** Entitlement snapshot for the open title (must be loaded). */
  access: ContentAccess;
  renting: boolean;
  onRent: () => void;
}

/**
 * The paywall moment: two ways into the screening room, side by side —
 * a one-time ticket (gold stub) or the monthly pass (indigo membership).
 * Renders nothing when neither option applies.
 */
export function AccessOptions({ access, renting, onRent }: AccessOptionsProps) {
  const rentOption = access.isRentable && access.rentalPrice != null;
  const subOption = access.subscriptionIncluded;

  // "From" price for the pass card — cheapest active plan.
  const [cheapest, setCheapest] = useState<Plan | null>(null);
  useEffect(() => {
    if (!subOption) return;
    billingApi
      .plans()
      .then((plans) => {
        const active = plans.filter((p) => p.active);
        active.sort((a, b) => a.price - b.price);
        setCheapest(active[0] ?? null);
      })
      .catch(() => setCheapest(null));
  }, [subOption]);

  if (!rentOption && !subOption) return null;

  const both = rentOption && subOption;

  return (
    <section aria-label="Үзэх эрх нээх" className="mt-5">
      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted">
        Үзэх эрх нээх
      </p>

      <div
        className={`mt-2.5 grid gap-3 ${both ? "sm:grid-cols-2" : "max-w-md"}`}
      >
        {rentOption ? (
          <RentTicketCard
            price={access.rentalPrice as number}
            durationHours={access.rentalDurationHours}
            renting={renting}
            onRent={onRent}
          />
        ) : null}

        {subOption ? (
          <SubscriptionPassCard cheapest={cheapest} recommended={both} />
        ) : null}
      </div>
    </section>
  );
}

/** Gold ticket stub: pay once, watch for a limited window. */
function RentTicketCard({
  price,
  durationHours,
  renting,
  onRent,
}: {
  price: number;
  durationHours: number;
  renting: boolean;
  onRent: () => void;
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-gold/25 bg-gradient-to-b from-gold/[.10] via-surface-raised/60 to-surface-raised/40 p-4 sm:p-5">
      <div className="flex items-center gap-2 text-gold">
        <IconTicket size={17} />
        <span className="text-[11px] font-bold uppercase tracking-[0.18em]">
          Нэг удаагийн билет
        </span>
      </div>

      <p className="mt-3 flex items-baseline gap-1.5">
        <span className="display text-3xl font-bold tabular-nums text-gold">
          {formatMnt(price)}
        </span>
        <span className="text-sm font-medium text-foreground/60">
          / {formatHours(durationHours)}
        </span>
      </p>
      <p className="mt-1.5 text-xs leading-relaxed text-muted">
        Төлбөр төлснөөс хойш {formatHours(durationHours)} турш хязгааргүй үзнэ.
      </p>

      <div className="mt-auto pt-4" aria-hidden>
        <div className="ticket-perforation h-px w-full" />
      </div>

      <Button
        variant="accent"
        size="lg"
        loading={renting}
        onClick={onRent}
        className="mt-4 w-full bg-gold text-background-deep shadow-[0_4px_20px_rgba(230,185,94,0.25)] hover:bg-gold/90"
      >
        <IconTicket size={18} />
        Түрээслэх
      </Button>
    </div>
  );
}

/** Indigo membership pass: everything in the catalog, every month. */
function SubscriptionPassCard({
  cheapest,
  recommended,
}: {
  cheapest: Plan | null;
  recommended: boolean;
}) {
  const per =
    cheapest == null
      ? null
      : cheapest.durationDay === 30
        ? "/ сар"
        : `/ ${cheapest.durationDay} хоног`;

  return (
    <div className="relative flex flex-col rounded-2xl border border-accent/30 bg-gradient-to-b from-accent/[.12] via-surface-raised/60 to-surface-raised/40 p-4 shadow-[inset_0_1px_0_rgba(124,140,255,0.15)] sm:p-5">
      {recommended ? (
        <span className="absolute -top-2.5 right-4 rounded-full bg-accent-strong px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-[0_2px_12px_rgba(93,110,245,0.45)]">
          Ашигтай
        </span>
      ) : null}

      <div className="flex items-center gap-2 text-accent">
        <IconSparkle size={17} />
        <span className="text-[11px] font-bold uppercase tracking-[0.18em]">
          Сарын гишүүнчлэл
        </span>
      </div>

      <p className="mt-3 flex items-baseline gap-1.5">
        {cheapest ? (
          <>
            <span className="display text-3xl font-bold tabular-nums text-foreground">
              {formatMnt(cheapest.price)}
            </span>
            <span className="text-sm font-medium text-foreground/60">{per}-аас</span>
          </>
        ) : (
          <span className="display text-3xl font-bold text-foreground">∞</span>
        )}
      </p>
      <p className="mt-1.5 text-xs leading-relaxed text-muted">
        Багцад орсон бүх кино, цувралыг хязгааргүй үзнэ.
      </p>

      <div className="mt-auto pt-4" />
      <ButtonLink href="/plans" variant="accent" size="lg" className="w-full">
        <IconSparkle size={18} />
        Багц авах
      </ButtonLink>
    </div>
  );
}
