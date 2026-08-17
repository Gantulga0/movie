"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { adminApi, storageApi } from "@/lib/api";
import type { ContentDetail, VideoQuality } from "@/lib/types";

const QUALITIES: VideoQuality[] = ["P480", "P720", "P1080", "P4K"];

/** R2 configured → presigned direct upload; otherwise local disk upload. */
function useStorageMode(): "r2" | "local" {
  const { token } = useAuth();
  const [mode, setMode] = useState<"r2" | "local">("local");
  useEffect(() => {
    if (!token) return;
    storageApi
      .mode(token)
      .then((res) => setMode(res.mode))
      .catch(() => setMode("local"));
  }, [token]);
  return mode;
}

/** Upload a video/trailer with whichever flow the backend supports. */
async function uploadVideoFile(
  token: string,
  mode: "r2" | "local",
  folder: "videos" | "trailers",
  file: File,
  onProgress: (p: number) => void,
): Promise<{ key: string; url: string }> {
  if (mode === "r2") {
    // .mkv etc. have no browser MIME type — presign and PUT must agree on
    // the same fallback or R2 rejects the signature with a 403.
    const contentType = file.type || "video/mp4";
    const presigned = await storageApi.presign(token, {
      folder,
      filename: file.name,
      contentType,
    });
    await storageApi.uploadDirect(presigned, file, onProgress, contentType);
    return { key: presigned.key, url: presigned.url };
  }
  return storageApi.uploadVideoLocal(token, folder, file, onProgress);
}

// ---------------------------------------------------------------- media

export function MediaSection({
  content,
  onChanged,
}: {
  content: ContentDetail;
  onChanged: () => void;
}) {
  const { token } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [trailerUrl, setTrailerUrl] = useState(content.trailerUrl ?? "");

  async function uploadImage(kind: "poster" | "banner", file: File) {
    if (!token) return;
    setBusy(kind);
    setError("");
    try {
      const res = await storageApi.uploadImage(token, kind, file);
      await adminApi.contentUpdate(token, content.id, {
        [kind === "poster" ? "posterUrl" : "backdropUrl"]: res.url,
      });
      onChanged();
    } catch {
      setError("Зураг хуулж чадсангүй. Дахин оролдоно уу.");
    } finally {
      setBusy(null);
    }
  }

  async function saveTrailer() {
    if (!token) return;
    setBusy("trailer");
    setError("");
    try {
      const value = trailerUrl.trim();
      await adminApi.contentUpdate(token, content.id, {
        trailerUrl: value || null,
      });
      onChanged();
    } catch {
      setError("Трейлер хадгалж чадсангүй. Дахин оролдоно уу.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <h2 className="text-sm font-bold text-white">Зураг ба трейлер</h2>
      <p className="mt-1 text-xs text-white/50">
        Дэвсгэр зураг + «Онцлох» чагт = нүүр хуудасны том зурагт гарна.
      </p>

      {error ? (
        <p className="mt-2 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
          {error}
        </p>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-4">
        <UploadTile
          label="Постер (2:3)"
          preview={content.posterUrl}
          busy={busy === "poster"}
          accept="image/*"
          onFile={(f) => uploadImage("poster", f)}
        />
        <UploadTile
          label="Дэвсгэр (16:9)"
          preview={content.backdropUrl}
          busy={busy === "banner"}
          accept="image/*"
          onFile={(f) => uploadImage("banner", f)}
        />
      </div>

      <div className="mt-4">
        <label className="text-xs font-semibold text-white/70">
          Трейлер (YouTube линк)
        </label>
        <div className="mt-1.5 flex gap-2">
          <input
            value={trailerUrl}
            onChange={(e) => setTrailerUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=…"
            aria-label="Трейлерийн YouTube линк"
            className="min-w-0 flex-1 rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/35 outline-none focus:border-brand"
          />
          <button
            type="button"
            onClick={saveTrailer}
            disabled={
              busy === "trailer" ||
              trailerUrl.trim() === (content.trailerUrl ?? "")
            }
            className="rounded-md bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20 disabled:opacity-40"
          >
            {busy === "trailer" ? "Хадгалж байна…" : "Хадгалах"}
          </button>
        </div>
        {trailerUrl.trim() && !/youtube\.com|youtu\.be/.test(trailerUrl) ? (
          <p className="mt-1 text-xs text-gold">
            YouTube линк оруулна уу (youtube.com эсвэл youtu.be).
          </p>
        ) : content.trailerUrl ? (
          <p className="mt-1 text-xs text-white/40">Трейлер орсон ✓</p>
        ) : null}
      </div>
    </section>
  );
}

// --------------------------------------------------------- video assets

export function VideoAssetsSection({
  contentId,
  episodeId,
  assets,
  onChanged,
}: {
  contentId: string;
  episodeId?: string;
  assets: Array<{ id: string; quality: VideoQuality }>;
  onChanged: () => void;
}) {
  const { token } = useAuth();
  const mode = useStorageMode();
  const [quality, setQuality] = useState<VideoQuality>("P1080");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  async function upload(file: File) {
    if (!token) return;
    setBusy(true);
    setProgress(0);
    setError("");
    try {
      const res = await uploadVideoFile(token, mode, "videos", file, setProgress);
      await adminApi.addVideoAsset(token, contentId, {
        episodeId,
        quality,
        url: res.url,
        r2Key: res.key,
        mimeType: file.type || "video/mp4",
        sizeBytes: file.size,
      });
      onChanged();
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? `Видео хуулж чадсангүй: ${err.message}`
          : "Видео хуулж чадсангүй. Дахин оролдоно уу.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove(assetId: string) {
    if (!token) return;
    await adminApi.removeVideoAsset(token, assetId).catch(() => undefined);
    onChanged();
  }

  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <h2 className="text-sm font-bold text-white">
        {episodeId ? "Ангийн видео файлууд" : "Киноны видео файлууд"}
      </h2>
      <p className="mt-1 text-xs text-white/50">
        {mode === "r2"
          ? "Файл шууд R2 руу хуулагдана — том файлд ч сервер ачаалахгүй."
          : "Локал горим: файл серверийн диск рүү хадгалагдана (R2 холбогдоогүй)."}
      </p>

      {error ? (
        <p className="mt-2 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
          {error}
        </p>
      ) : null}

      {assets.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {assets.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between rounded-md bg-white/5 px-3 py-2 text-sm"
            >
              <span className="font-semibold text-white">
                {a.quality.replace("P", "")}p
              </span>
              <button
                type="button"
                onClick={() => remove(a.id)}
                className="text-xs font-semibold text-brand hover:text-brand-hover"
              >
                Устгах
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-white/40">Видео файл ороогүй байна.</p>
      )}

      <div className="mt-4 flex items-center gap-2">
        <select
          value={quality}
          onChange={(e) => setQuality(e.target.value as VideoQuality)}
          aria-label="Чанар"
          className="rounded-md border border-white/15 bg-surface-raised px-2.5 py-2 text-sm text-white outline-none focus:border-brand"
        >
          {QUALITIES.map((q) => (
            <option key={q} value={q}>
              {q.replace("P", "")}p
            </option>
          ))}
        </select>
        <UploadRow
          label="Видео нэмэх"
          busy={busy}
          progress={progress}
          accept="video/*"
          onFile={upload}
          compact
        />
      </div>
    </section>
  );
}

// -------------------------------------------------------------- seasons

export function SeasonsSection({
  content,
  onChanged,
}: {
  content: ContentDetail;
  onChanged: () => void;
}) {
  const { token } = useAuth();
  const [epTitle, setEpTitle] = useState("");
  const [epSeason, setEpSeason] = useState("");

  async function addSeason() {
    if (!token) return;
    const number = content.seasons.length + 1;
    await adminApi
      .addSeason(token, content.id, { number, title: `Улирал ${number}` })
      .catch(() => undefined);
    onChanged();
  }

  async function addEpisode(seasonId: string) {
    if (!token || !epTitle.trim()) return;
    const season = content.seasons.find((s) => s.id === seasonId);
    const number = (season?.episodes.length ?? 0) + 1;
    await adminApi
      .addEpisode(token, seasonId, { number, title: epTitle.trim() })
      .catch(() => undefined);
    setEpTitle("");
    onChanged();
  }

  async function removeEpisode(episodeId: string) {
    if (!token) return;
    await adminApi.removeEpisode(token, episodeId).catch(() => undefined);
    onChanged();
  }

  async function removeSeason(seasonId: string) {
    if (!token) return;
    if (!window.confirm("Улирлыг бүх ангитай нь устгах уу?")) return;
    await adminApi.removeSeason(token, seasonId).catch(() => undefined);
    onChanged();
  }

  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-white">Улирал, ангиуд</h2>
        <button
          type="button"
          onClick={addSeason}
          className="rounded-md border border-white/20 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/10"
        >
          + Улирал
        </button>
      </div>

      {content.seasons.length === 0 ? (
        <p className="mt-3 text-sm text-white/40">Улирал нэмээгүй байна.</p>
      ) : (
        content.seasons.map((season) => (
          <div key={season.id} className="mt-4 rounded-lg border border-line/60 p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-white/60">
                {season.title ?? `Улирал ${season.number}`}
              </p>
              <button
                type="button"
                onClick={() => removeSeason(season.id)}
                className="text-xs text-brand hover:text-brand-hover"
              >
                Устгах
              </button>
            </div>

            <ul className="mt-2 space-y-2">
              {season.episodes.map((ep) => (
                <li key={ep.id} className="rounded-md bg-white/5 p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white">
                      {ep.number}. {ep.title}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeEpisode(ep.id)}
                      className="text-xs text-brand hover:text-brand-hover"
                    >
                      Устгах
                    </button>
                  </div>
                  <div className="mt-2">
                    <VideoAssetsSection
                      contentId={content.id}
                      episodeId={ep.id}
                      assets={ep.videoAssets ?? []}
                      onChanged={onChanged}
                    />
                  </div>
                </li>
              ))}
            </ul>

            {/* New episode */}
            <div className="mt-3 flex gap-2">
              <input
                value={epSeason === season.id ? epTitle : ""}
                onFocus={() => setEpSeason(season.id)}
                onChange={(e) => {
                  setEpSeason(season.id);
                  setEpTitle(e.target.value);
                }}
                placeholder="Шинэ ангийн нэр…"
                aria-label="Шинэ ангийн нэр"
                className="min-w-0 flex-1 rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/35 outline-none focus:border-brand"
              />
              <button
                type="button"
                onClick={() => addEpisode(season.id)}
                disabled={epSeason !== season.id || !epTitle.trim()}
                className="rounded-md bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/20 disabled:opacity-40"
              >
                Нэмэх
              </button>
            </div>
          </div>
        ))
      )}
    </section>
  );
}

// ------------------------------------------------------- upload helpers

function UploadTile({
  label,
  preview,
  busy,
  accept,
  onFile,
}: {
  label: string;
  preview: string | null;
  busy: boolean;
  accept: string;
  onFile: (file: File) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <button
      type="button"
      onClick={() => ref.current?.click()}
      disabled={busy}
      className="group relative aspect-video overflow-hidden rounded-lg border border-dashed border-white/20 bg-white/5 transition hover:border-brand/60 disabled:opacity-60"
    >
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="" className="h-full w-full object-cover" />
      ) : null}
      <span
        className={`absolute inset-0 grid place-items-center text-xs font-semibold ${
          preview
            ? "bg-black/60 text-white opacity-0 transition group-hover:opacity-100"
            : "text-white/60"
        }`}
      >
        {busy ? "Хуулж байна…" : label}
      </span>
      <input
        ref={ref}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
    </button>
  );
}

function UploadRow({
  label,
  hint,
  busy,
  progress,
  accept,
  onFile,
  compact,
}: {
  label: string;
  hint?: string;
  busy: boolean;
  progress: number;
  accept: string;
  onFile: (file: File) => void;
  compact?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className={compact ? "flex-1" : ""}>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={busy}
        className="w-full rounded-md border border-white/20 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-60"
      >
        {busy ? `Хуулж байна… ${progress}%` : label}
      </button>
      {busy ? (
        <div className="mt-1.5 h-1 overflow-hidden rounded bg-white/10">
          <div
            className="h-full bg-brand transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      ) : hint ? (
        <p className="mt-1 text-xs text-white/40">{hint}</p>
      ) : null}
      <input
        ref={ref}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
