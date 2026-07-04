import Link from "next/link";
import { Logo } from "./Logo";

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}

export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <main className="relative isolate flex min-h-screen flex-col bg-background">
      {/* Cinematic background */}
      <div className="absolute inset-0 -z-10">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 120% at 20% 0%, #3b1d6e 0%, #141033 40%, #050509 100%)",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/30" />
      </div>

      <header className="px-5 py-5 sm:px-10 sm:py-6">
        <Logo />
      </header>

      <div className="flex flex-1 items-center justify-center px-5 py-8">
        <div className="w-full max-w-md animate-rise rounded-2xl border border-white/10 bg-black/50 p-7 shadow-2xl backdrop-blur-md sm:p-9">
          <h1 className="text-2xl font-bold text-white sm:text-3xl">{title}</h1>
          <p className="mt-2 text-sm text-white/60">{subtitle}</p>

          <div className="mt-7">{children}</div>

          <div className="mt-6 text-center text-sm text-white/60">{footer}</div>
        </div>
      </div>
    </main>
  );
}

export function AuthLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="font-semibold text-white hover:text-brand">
      {children}
    </Link>
  );
}
