import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";

type Variant = "primary" | "accent" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

/**
 * Primary = ivory, like the projector light itself — reserved for the one
 * main action on screen (Watch, Pay). Accent = indigo for secondary CTAs.
 */
const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-foreground text-background font-bold hover:bg-white shadow-[0_4px_24px_rgba(242,239,232,0.12)]",
  accent:
    "bg-accent-strong text-white font-bold hover:bg-accent shadow-[0_4px_20px_rgba(93,110,245,0.3)]",
  outline:
    "border border-line-strong bg-white/[.04] text-foreground font-semibold hover:bg-white/10",
  ghost: "text-muted font-semibold hover:bg-white/[.07] hover:text-foreground",
  danger:
    "border border-danger/40 bg-danger/10 text-danger font-semibold hover:bg-danger/20",
};

const SIZES: Record<Size, string> = {
  sm: "px-3.5 py-2 text-sm rounded-lg gap-1.5",
  md: "px-5 py-2.5 text-sm rounded-lg gap-2",
  lg: "px-7 py-3 text-base rounded-xl gap-2",
};

const BASE =
  "inline-flex items-center justify-center transition select-none active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-55";

function classes(variant: Variant, size: Size, className: string) {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`;
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export function Button({
  variant = "outline",
  size = "md",
  loading = false,
  className = "",
  children,
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={classes(variant, size, className)}
      {...props}
    >
      {loading ? (
        <span
          aria-hidden
          className="h-4 w-4 animate-spin rounded-full border-2 border-current/25 border-t-current"
        />
      ) : null}
      {children}
    </button>
  );
}

interface ButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  variant?: Variant;
  size?: Size;
}

export function ButtonLink({
  href,
  variant = "outline",
  size = "md",
  className = "",
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link href={href} className={classes(variant, size, className)} {...props}>
      {children}
    </Link>
  );
}
