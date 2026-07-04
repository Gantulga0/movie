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
