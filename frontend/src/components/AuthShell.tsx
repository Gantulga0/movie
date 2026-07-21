"use client";

import Link from "next/link";
import { LineWaves } from "./LineWaves";
import { Logo } from "./Logo";

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}

/**
 * Auth stage: a calm indigo field of animated "line waves" behind a single
 * glass card. The backdrop runs on every screen size and settles to a static
 * frame for reduced-motion users. No data, no dependencies.
 */
export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <main className="relative isolate flex min-h-screen flex-col overflow-hidden bg-background-deep">
      {/* Stage backdrop */}
      <div aria-hidden className="absolute inset-0 -z-10">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(130% 110% at 50% -10%, #1c2647 0%, #10162b 45%, #05080f 100%)",
          }}
        />
        <LineWaves className="absolute inset-0" />
        {/* Vignette keeps the card the brightest thing on stage. */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(80% 70% at 50% 55%, transparent 0%, rgba(5,8,15,0.5) 100%)",
          }}
        />
      </div>

      <header className="px-5 py-5 sm:px-10 sm:py-6">
        <Logo />
      </header>

      <div className="flex flex-1 items-center justify-center px-5 py-8">
        <div className="animate-rise w-full max-w-md rounded-2xl border border-white/10 bg-background-deep/55 p-7 shadow-pop backdrop-blur-xl sm:p-9">
          <h1 className="display text-3xl font-bold text-foreground">{title}</h1>
          <p className="mt-2 text-sm text-muted">{subtitle}</p>

          <div className="mt-7">{children}</div>

          <div className="mt-6 text-center text-sm text-muted">{footer}</div>
        </div>
      </div>
    </main>
  );
}

export function AuthLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="font-semibold text-accent transition hover:text-accent-hover"
    >
      {children}
    </Link>
  );
}
