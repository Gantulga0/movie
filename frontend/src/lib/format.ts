import type { ContentType } from "./types";

/** Content-type badge label: MOVIE → "Кино", SERIES → "Цуврал", NOVEL → "Бичвэр". */
export function typeLabel(type: ContentType): string {
  switch (type) {
    case "SERIES":
      return "Цуврал";
    case "NOVEL":
      return "Бичвэр";
    default:
      return "Кино";
  }
}

/** 8000 -> "8,000₮" */
export function formatMnt(amount: number): string {
  return `${amount.toLocaleString("en-US")}₮`;
}

/** 10140 -> "2ц 49м", 3540 -> "59м" */
export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h > 0 ? `${h}ц ${m}м` : `${m}м`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("mn-MN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/** Days left until an ISO instant; 0 when already past. */
export function daysLeft(iso: string): number {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

/** Share of the [startedAt, endsAt] window still ahead, clamped to 2–100. */
export function remainingPercent(startedAt: string, endsAt: string): number {
  const end = new Date(endsAt).getTime();
  const start = new Date(startedAt).getTime();
  if (end <= start) return 0;
  const pct = Math.round(((end - Date.now()) / (end - start)) * 100);
  return Math.min(100, Math.max(2, pct));
}

/** 1938 -> "32:18" , 7425 -> "2:03:45" — player-style position stamp. */
export function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Remaining ISO time as "3 хоног 4 цаг" / "5 цаг" / "42 минут". */
export function formatRemaining(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "Дууссан";
  const totalMinutes = Math.floor(ms / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return hours > 0 ? `${days} хоног ${hours} цаг` : `${days} хоног`;
  if (hours > 0) return minutes > 0 ? `${hours} цаг ${minutes} мин` : `${hours} цаг`;
  return `${minutes} минут`;
}

/** 48 -> "48 цаг", 72 -> "3 хоног" — rental duration label. */
export function formatHours(hours: number): string {
  if (hours % 24 === 0 && hours >= 24) return `${hours / 24} хоног`;
  return `${hours} цаг`;
}

/** Watched share of a title, clamped to [0, 100]. */
export function watchedPercent(
  progressSec: number,
  durationSec: number | null | undefined,
): number | null {
  if (!durationSec || durationSec <= 0) return null;
  return Math.min(100, Math.max(0, Math.round((progressSec / durationSec) * 100)));
}
