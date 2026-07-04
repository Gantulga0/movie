"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "./Logo";
import { useAuth } from "@/lib/auth-context";

const NAV_ITEMS = [
  { href: "/home", label: "Нүүр" },
  { href: "/home?type=MOVIE", label: "Кино" },
  { href: "/home?type=SERIES", label: "Цуврал" },
  { href: "/my-list", label: "Миний жагсаалт" },
];

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-black/75 backdrop-blur-md">
      <div className="flex items-center justify-between px-5 py-3.5 sm:px-10">
        <div className="flex items-center gap-8">
          <Logo />
          <nav className="hidden gap-6 text-sm font-medium text-white/70 md:flex">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`transition hover:text-white ${
                  pathname === item.href.split("?")[0] && item.href.includes(pathname)
                    ? "text-white"
                    : ""
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/plans"
            className="hidden rounded-md border border-brand/60 px-3.5 py-1.5 text-sm font-semibold text-white transition hover:bg-brand sm:block"
          >
            Багц
          </Link>

          {/* Account menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-white/80 transition hover:bg-white/10"
            >
              <span className="grid h-8 w-8 place-items-center rounded bg-brand text-sm font-bold text-white">
                {(user?.name?.[0] ?? user?.phone?.[0] ?? "?").toUpperCase()}
              </span>
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden>
                <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>

            {menuOpen ? (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-56 overflow-hidden rounded-lg border border-line bg-surface shadow-2xl"
              >
                <div className="border-b border-line px-4 py-3">
                  <p className="truncate text-sm font-semibold text-white">
                    {user?.name ?? user?.phone}
                  </p>
                  <p className="mt-0.5 text-xs text-white/50">ID: {user?.publicId}</p>
                </div>
                <MenuLink href="/account" onClick={() => setMenuOpen(false)}>
                  Миний бүртгэл
                </MenuLink>
                <MenuLink href="/plans" onClick={() => setMenuOpen(false)}>
                  Багц, төлбөр
                </MenuLink>
                {user?.role === "ADMIN" ? (
                  <MenuLink href="/admin" onClick={() => setMenuOpen(false)}>
                    Админ самбар
                  </MenuLink>
                ) : null}
                <button
                  type="button"
                  role="menuitem"
                  onClick={async () => {
                    await logout();
                    router.replace("/");
                  }}
                  className="block w-full px-4 py-2.5 text-left text-sm text-white/80 transition hover:bg-white/10"
                >
                  Гарах
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}

function MenuLink({
  href,
  onClick,
  children,
}: {
  href: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onClick}
      className="block px-4 py-2.5 text-sm text-white/80 transition hover:bg-white/10"
    >
      {children}
    </Link>
  );
}
