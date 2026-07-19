import Link from "next/link";

/**
 * Brand lockup: the infinity mark with the INFINITE wordmark.
 * The mark carries a soft indigo glow — the projector light of the brand.
 */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`group flex select-none items-center gap-2.5 ${className}`}
      aria-label="Infinite нүүр хуудас"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/infinity.png"
        alt=""
        className="h-9 w-auto drop-shadow-[0_0_14px_rgba(124,140,255,0.55)] transition duration-300 group-hover:drop-shadow-[0_0_22px_rgba(124,140,255,0.8)]"
      />
      <span className="display text-3xl font-bold tracking-tight text-white">
        INFINITE
      </span>
    </Link>
  );
}
