"use client";

import { useEffect, useRef, useState } from "react";
import { adminApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatDate } from "@/lib/format";
import { uploadVideoFile, useStorageMode } from "@/lib/upload";
import type { ContentDetail } from "@/lib/types";

interface ChapterFormState {
  /** null = creating; otherwise the chapter being edited. */
  chapterId: string | null;
  number: string;
  title: string;
  body: string;
  /** Attached audio/video: url + key + mimeType, or all empty for none. */
  mediaUrl: string;
  mediaR2Key: string;
  mediaMimeType: string;
}

/**
 * Single-chapter story editor: no chapter list, no add/remove — one chapter
 * (number 1, titled after the content) edited inline with text and/or video.
 */
export function SingleChapterSection({
  content,
  onChanged,
}: {
  content: ContentDetail;
  onChanged: () => void;
}) {
  const { token } = useAuth();
  const mode = useStorageMode();
  const existing = content.chapters[0] ?? null;

  const [body, setBody] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaR2Key, setMediaR2Key] = useState("");
  const [mediaMimeType, setMediaMimeType] = useState("");
  const [loaded, setLoaded] = useState(!existing);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // The detail payload has no body — fetch the full chapter once.
  useEffect(() => {
    if (!token || !existing) return;
    let cancelled = false;
    adminApi
      .chapterGet(token, existing.id)
      .then((ch) => {
        if (cancelled) return;
        setBody(ch.body);
        setMediaUrl(ch.mediaUrl ?? "");
        setMediaR2Key(ch.mediaR2Key ?? "");
        setMediaMimeType(ch.mediaMimeType ?? "");
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setError("Бүлэг ачаалж чадсангүй.");
      });
    return () => {
      cancelled = true;
    };
  }, [token, existing]);

  const hasMedia = Boolean(mediaUrl || mediaR2Key);

  async function uploadMedia(file: File) {
    if (!token) return;
    setUploading(true);
    setProgress(0);
    setError("");
    setSaved(false);
    try {
      const res = await uploadVideoFile(token, mode, "videos", file, setProgress);
      setMediaUrl(res.url);
      setMediaR2Key(res.key);
      setMediaMimeType(res.mimeType);
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? `Файл хуулж чадсангүй: ${err.message}`
          : "Файл хуулж чадсангүй. Дахин оролдоно уу.",
      );
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!token) return;
    if (!body.trim() && !hasMedia) return;
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const payload = { body, mediaUrl, mediaR2Key, mediaMimeType };
      if (existing) {
        await adminApi.updateChapter(token, existing.id, payload);
      } else {
        await adminApi.addChapter(token, content.id, {
          number: 1,
          title: content.title,
          ...payload,
        });
      }
      setSaved(true);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Хадгалахад алдаа гарлаа.");
    } finally {
      setSaving(false);
    }
  }

  const input =
    "w-full rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/35 outline-none focus:border-brand";

  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <h2 className="text-sm font-bold text-white">Өгүүллэгийн агуулга</h2>
      <p className="mt-1 text-xs text-white/50">
        Нэг бүлэгтэй өгүүллэг — текст эсвэл бичлэгээ шууд эндээс оруулна.
      </p>

      {error ? (
        <p className="mt-3 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
          {error}
        </p>
      ) : null}

      {!loaded ? (
        <div className="mt-4 flex justify-center py-6">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-brand" />
        </div>
      ) : (
        <>
          {/* Video attachment */}
          <div className="mt-4 rounded-md border border-white/10 bg-white/[.03] p-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="rounded-md border border-white/20 bg-white/5 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/10 disabled:opacity-60"
              >
                {uploading
                  ? `Хуулж байна… ${progress}%`
                  : hasMedia
                    ? "Бичлэг солих"
                    : "🎬 Бичлэг нэмэх"}
              </button>
              {hasMedia && !uploading ? (
                <>
                  <span className="text-xs text-white/60">Бичлэг хавсаргасан ✓</span>
                  <button
                    type="button"
                    onClick={() => {
                      setMediaUrl("");
                      setMediaR2Key("");
                      setMediaMimeType("");
                      setSaved(false);
                    }}
                    className="text-xs text-brand hover:text-brand-hover"
                  >
                    Арилгах
                  </button>
                </>
              ) : null}
              <input
                ref={fileRef}
                type="file"
                accept="video/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadMedia(f);
                  e.target.value = "";
                }}
              />
            </div>
            {uploading ? (
              <div className="mt-2 h-1 overflow-hidden rounded bg-white/10">
                <div
                  className="h-full bg-brand transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            ) : null}
          </div>

          <textarea
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              setSaved(false);
            }}
            placeholder={
              hasMedia
                ? "Текст (заавал биш)…"
                : "Өгүүллэгийн текст…\n\nДогол мөрүүдийг хоосон мөрөөр тусгаарлана."
            }
            aria-label="Өгүүллэгийн текст"
            className={`${input} mt-3 min-h-72 resize-y font-normal leading-relaxed`}
          />
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={saving || uploading || (!body.trim() && !hasMedia)}
              className="rounded-md bg-brand px-4 py-2 text-xs font-bold text-white transition hover:bg-brand-hover disabled:opacity-40"
            >
              {saving ? "Хадгалж байна…" : "Хадгалах"}
            </button>
            {saved ? (
              <span className="text-xs text-white/50">Хадгалагдлаа ✓</span>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}

/**
 * Admin chapter manager for novels: ordered rows plus a plain-text editor.
 * Audio-story chapters can carry a media file instead of (or alongside) text.
 * Bodies aren't in the detail payload — editing lazily fetches the chapter.
 */
export function ChaptersSection({
  content,
  onChanged,
}: {
  content: ContentDetail;
  onChanged: () => void;
}) {
  const { token } = useAuth();
  const mode = useStorageMode();
  const [form, setForm] = useState<ChapterFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const nextNumber =
    content.chapters.reduce((max, c) => Math.max(max, c.number), 0) + 1;

  function startCreate() {
    setError("");
    setForm({
      chapterId: null,
      number: String(nextNumber),
      title: "",
      body: "",
      mediaUrl: "",
      mediaR2Key: "",
      mediaMimeType: "",
    });
  }

  async function startEdit(chapterId: string) {
    if (!token) return;
    setError("");
    try {
      const ch = await adminApi.chapterGet(token, chapterId);
      setForm({
        chapterId: ch.id,
        number: String(ch.number),
        title: ch.title,
        body: ch.body,
        mediaUrl: ch.mediaUrl ?? "",
        mediaR2Key: ch.mediaR2Key ?? "",
        mediaMimeType: ch.mediaMimeType ?? "",
      });
    } catch {
      setError("Бүлэг ачаалж чадсангүй.");
    }
  }

  async function uploadMedia(file: File) {
    if (!token) return;
    setUploading(true);
    setProgress(0);
    setError("");
    try {
      const res = await uploadVideoFile(token, mode, "videos", file, setProgress);
      setForm((f) =>
        f
          ? {
              ...f,
              mediaUrl: res.url,
              mediaR2Key: res.key,
              mediaMimeType: res.mimeType,
            }
          : f,
      );
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? `Файл хуулж чадсангүй: ${err.message}`
          : "Файл хуулж чадсангүй. Дахин оролдоно уу.",
      );
    } finally {
      setUploading(false);
    }
  }

  const hasMedia = Boolean(form?.mediaUrl || form?.mediaR2Key);

  async function save() {
    if (!token || !form) return;
    const payload = {
      number: Number(form.number),
      title: form.title.trim(),
      body: form.body,
      mediaUrl: form.mediaUrl,
      mediaR2Key: form.mediaR2Key,
      mediaMimeType: form.mediaMimeType,
    };
    if (!payload.number || !payload.title) return;
    if (!form.body.trim() && !hasMedia) return;
    setSaving(true);
    setError("");
    try {
      if (form.chapterId) {
        await adminApi.updateChapter(token, form.chapterId, payload);
      } else {
        await adminApi.addChapter(token, content.id, payload);
      }
      setForm(null);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Хадгалахад алдаа гарлаа.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(chapterId: string) {
    if (!token) return;
    if (!window.confirm("Энэ бүлгийг устгах уу?")) return;
    await adminApi.removeChapter(token, chapterId).catch(() => undefined);
    if (form?.chapterId === chapterId) setForm(null);
    onChanged();
  }

  const input =
    "w-full rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/35 outline-none focus:border-brand";

  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-white">Бүлгүүд</h2>
        <button
          type="button"
          onClick={startCreate}
          className="rounded-md border border-white/20 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/10"
        >
          + Бүлэг нэмэх
        </button>
      </div>
      <p className="mt-1 text-xs text-white/50">
        Сонсдог өгүүллэгт бүлэг бүр дээр бичлэг оруулж болно — текст заавал
        биш.
      </p>

      {error ? (
        <p className="mt-3 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
          {error}
        </p>
      ) : null}

      {content.chapters.length === 0 && !form ? (
        <p className="mt-3 text-sm text-white/40">Бүлэг нэмээгүй байна.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {content.chapters.map((ch) => (
            <li
              key={ch.id}
              className="flex items-center justify-between gap-3 rounded-md bg-white/5 px-3 py-2.5"
            >
              <span className="min-w-0 truncate text-sm text-white">
                {ch.number}. {ch.title}
                {ch.mediaMimeType ? (
                  <span className="ml-2 rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-white/70">
                    🎬 Бичлэг
                  </span>
                ) : null}
              </span>
              <span className="flex shrink-0 items-center gap-3">
                <span className="hidden text-xs text-white/35 sm:inline">
                  {formatDate(ch.createdAt)}
                </span>
                <button
                  type="button"
                  onClick={() => startEdit(ch.id)}
                  className="text-xs font-semibold text-white/70 hover:text-white"
                >
                  Засах
                </button>
                <button
                  type="button"
                  onClick={() => remove(ch.id)}
                  className="text-xs text-brand hover:text-brand-hover"
                >
                  Устгах
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {form ? (
        <div className="mt-4 rounded-lg border border-line/60 p-3">
          <p className="text-xs font-bold uppercase tracking-wider text-white/60">
            {form.chapterId ? "Бүлэг засах" : "Шинэ бүлэг"}
          </p>
          <div className="mt-3 flex gap-2 flex-wrap">
            <input
              type="number"
              min={1}
              value={form.number}
              onChange={(e) =>
                setForm((f) => (f ? { ...f, number: e.target.value } : f))
              }
              aria-label="Бүлгийн дугаар"
              className={`${input} w-24 flex-none`}
            />
            <input
              value={form.title}
              onChange={(e) =>
                setForm((f) => (f ? { ...f, title: e.target.value } : f))
              }
              placeholder="Бүлгийн гарчиг…"
              aria-label="Бүлгийн гарчиг"
              className={`${input} min-w-[260px] flex-1 text-base`}
            />
          </div>

          {/* Audio/video attachment */}
          <div className="mt-2 rounded-md border border-white/10 bg-white/[.03] p-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="rounded-md border border-white/20 bg-white/5 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/10 disabled:opacity-60"
              >
                {uploading
                  ? `Хуулж байна… ${progress}%`
                  : hasMedia
                    ? "Бичлэг солих"
                    : "🎬 Бичлэг нэмэх"}
              </button>
              {hasMedia && !uploading ? (
                <>
                  <span className="text-xs text-white/60">
                    Бичлэг хавсаргасан ✓
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((f) =>
                        f
                          ? { ...f, mediaUrl: "", mediaR2Key: "", mediaMimeType: "" }
                          : f,
                      )
                    }
                    className="text-xs text-brand hover:text-brand-hover"
                  >
                    Арилгах
                  </button>
                </>
              ) : null}
              <input
                ref={fileRef}
                type="file"
                accept="video/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadMedia(f);
                  e.target.value = "";
                }}
              />
            </div>
            {uploading ? (
              <div className="mt-2 h-1 overflow-hidden rounded bg-white/10">
                <div
                  className="h-full bg-brand transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            ) : null}
          </div>

          <textarea
            value={form.body}
            onChange={(e) =>
              setForm((f) => (f ? { ...f, body: e.target.value } : f))
            }
            placeholder={
              hasMedia
                ? "Текст (заавал биш)…"
                : "Бүлгийн текст…\n\nДогол мөрүүдийг хоосон мөрөөр тусгаарлана."
            }
            aria-label="Бүлгийн текст"
            className={`${input} mt-2 min-h-72 resize-y font-normal leading-relaxed`}
          />
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={save}
              disabled={
                saving ||
                uploading ||
                !form.title.trim() ||
                (!form.body.trim() && !hasMedia) ||
                !Number(form.number)
              }
              className="rounded-md bg-brand px-4 py-2 text-xs font-bold text-white transition hover:bg-brand-hover disabled:opacity-40"
            >
              {saving ? "Хадгалж байна…" : "Хадгалах"}
            </button>
            <button
              type="button"
              onClick={() => setForm(null)}
              className="rounded-md px-3 py-2 text-xs font-semibold text-white/60 transition hover:text-white"
            >
              Болих
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
