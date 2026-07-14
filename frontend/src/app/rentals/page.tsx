"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useDetails } from "@/components/details/DetailsModalProvider";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { IconClock, IconPlay, IconTicket } from "@/components/ui/icons";
import { useAuth } from "@/lib/auth-context";
import { billingApi } from "@/lib/api";
import type { Rental } from "@/lib/types";
import { formatDate, formatRemaining } from "@/lib/format";

export default function RentalsPage() {
  return (
    <AppShell>
      <RentalsContent />
    </AppShell>
  );
}

interface RentalSplit {
  active: Rental[];
  expired: Rental[];
}

/** Active/expired split is stamped once, when the data arrives. */
function splitRentals(rentals: Rental[]): RentalSplit {
  const now = Date.now();
  const active: Rental[] = [];
  const expired: Rental[] = [];
  for (const r of rentals) {
    (new Date(r.endsAt).getTime() > now ? active : expired).push(r);
  }
  return { active, expired };
}

function RentalsContent() {
  const { token } = useAuth();
  const { openDetails } = useDetails();
  const [split, setSplit] = useState<RentalSplit>({ active: [], expired: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    billingApi
      .rentals(token)
      .then((rows) => setSplit(splitRentals(rows)))
      .catch(() => setSplit({ active: [], expired: [] }))
      .finally(() => setLoading(false));
  }, [token]);

  const { active, expired } = split;
  const isEmpty = active.length === 0 && expired.length === 0;

  return (
    <div className="px-5 py-8 sm:px-10">
      <h1 className="display text-2xl font-semibold text-foreground sm:text-3xl">
        Миний түрээс
      </h1>
      <p className="mt-1 text-sm text-muted">
        Түрээсэлсэн кино тус бүр өөрийн хугацаатай — хугацаа дуустал хүссэн
        хэмжээгээрээ үзэж болно.
      </p>

      {loading ? (
        <div className="mt-6 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      ) : isEmpty ? (
        <div className="mt-6">
          <EmptyState
            icon={<IconTicket size={40} />}
            title="Түрээс байхгүй байна"
            description="Түрээсийн боломжтой кинонууд дээр «Түрээслэх» товч гарч ирнэ — нэг удаагийн төлбөрөөр тодорхой хугацаанд үзэх эрх нээгдэнэ."
            action={
              <ButtonLink href="/browse" variant="accent">
                Кино үзэх
              </ButtonLink>
            }
          />
        </div>
      ) : (
        <>
          {active.length > 0 ? (
            <section className="mt-7">
              <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-muted">
                Идэвхтэй
              </h2>
              <div className="mt-3 space-y-3">
                {active.map((rental) => (
                  <RentalRow key={rental.id} rental={rental} active onOpen={openDetails} />
                ))}
              </div>
            </section>
          ) : null}

          {expired.length > 0 ? (
            <section className="mt-9">
              <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-muted">
                Хугацаа дууссан
              </h2>
              <div className="mt-3 space-y-3">
                {expired.map((rental) => (
                  <RentalRow key={rental.id} rental={rental} onOpen={openDetails} />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

function RentalRow({
  rental,
  active = false,
  onOpen,
}: {
  rental: Rental;
  active?: boolean;
  onOpen: (slug: string) => void;
}) {
  const { content } = rental;
  return (
    <div
      className={`flex items-center gap-4 rounded-2xl border px-4 py-3.5 transition ${
        active
          ? "border-gold/25 bg-gold/[.06]"
          : "border-line bg-surface/60 opacity-75"
      }`}
    >
      <button
        type="button"
        onClick={() => onOpen(content.slug)}
        className="h-20 w-14 shrink-0 overflow-hidden rounded-lg border border-line bg-surface-raised"
        aria-label={`${content.title} — дэлгэрэнгүй`}
      >
        {content.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={content.posterUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : null}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onOpen(content.slug)}
            className="truncate text-sm font-bold text-foreground transition hover:text-accent"
          >
            {content.title}
          </button>
          {active ? <Badge tone="gold">Идэвхтэй</Badge> : <Badge>Дууссан</Badge>}
        </div>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
          <IconClock size={13} />
          {active
            ? `${formatRemaining(rental.endsAt)} үлдсэн`
            : `${formatDate(rental.endsAt)}-нд дууссан`}
        </p>
      </div>

      {active ? (
        <ButtonLink href={`/watch/${content.id}`} variant="primary" size="sm">
          <IconPlay size={15} />
          Үзэх
        </ButtonLink>
      ) : (
        <button
          type="button"
          onClick={() => onOpen(content.slug)}
          className="shrink-0 text-xs font-semibold text-accent transition hover:text-accent-hover"
        >
          Дахин түрээслэх
        </button>
      )}
    </div>
  );
}
