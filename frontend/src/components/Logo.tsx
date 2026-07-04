import Link from "next/link";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`display select-none text-2xl font-bold tracking-tight ${className}`}
      aria-label="Infinite нүүр хуудас"
    >
      <span className="mr-1 text-brand">∞</span>
      <span className="text-white">INFINITE</span>
    </Link>
  );
}
