/**
 * Shared page masthead: an accent eyebrow with a fading light-line,
 * a display-face title, and an optional one-line subtitle. Keeps every
 * screen opening on the same cinematic note.
 */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <header>
      <p className="flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.3em] text-accent">
        <span
          aria-hidden
          className="h-px w-7 bg-gradient-to-r from-accent to-transparent"
        />
        {eyebrow}
      </p>
      <h1 className="display mt-2 text-3xl font-bold text-foreground sm:text-4xl">
        {title}
      </h1>
      {subtitle ? (
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
          {subtitle}
        </p>
      ) : null}
    </header>
  );
}
