type Tone = "default" | "accent" | "gold" | "teal" | "success" | "danger";

const TONES: Record<Tone, string> = {
  default: "bg-white/10 text-foreground/80",
  accent: "bg-accent/15 text-accent",
  gold: "bg-gold/15 text-gold",
  teal: "bg-teal/15 text-teal",
  success: "bg-success/15 text-success",
  danger: "bg-danger/15 text-danger",
};

export function Badge({
  tone = "default",
  className = "",
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
