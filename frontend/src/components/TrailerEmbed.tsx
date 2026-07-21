"use client";

/** Extract the 11-char video id from any common YouTube URL form. */
export function youTubeId(url: string): string | null {
  return (
    url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/|live\/)([\w-]{11})/)?.[1] ?? null
  );
}

/** Trailer playback — embedded from a YouTube link only. */
export function TrailerEmbed({
  url,
  title,
  className,
}: {
  url: string;
  title: string;
  className?: string;
}) {
  const id = youTubeId(url);
  if (!id) {
    return (
      <div
        className={`grid place-items-center bg-black text-sm text-white/50 ${className ?? ""}`}
      >
        Трейлер боломжгүй байна.
      </div>
    );
  }
  return (
    <iframe
      src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
      title={`${title} — трейлер`}
      allow="autoplay; encrypted-media; picture-in-picture"
      allowFullScreen
      className={className ?? "h-full w-full"}
    />
  );
}
