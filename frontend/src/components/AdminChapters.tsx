"use client";

import { useState } from "react";
import { adminApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatDate } from "@/lib/format";
import type { ContentDetail } from "@/lib/types";

interface ChapterFormState {
  /** null = creating; otherwise the chapter being edited. */
  chapterId: string | null;
  number: string;
  title: string;
  body: string;
}

/**
 * Admin chapter manager for novels: ordered rows plus a plain-text editor.
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
  const [form, setForm] = useState<ChapterFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const nextNumber =
    content.chapters.reduce((max, c) => Math.max(max, c.number), 0) + 1;

  function startCreate() {
    setError("");
    setForm({
      chapterId: null,
      number: String(nextNumber),
      title: "",
      body: "",
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
      });
    } catch {
      setError("Бүлэг ачаалж чадсангүй.");
    }
  }

  async function save() {
    if (!token || !form) return;
    const payload = {
      number: Number(form.number),
      title: form.title.trim(),
      body: form.body,
    };
    if (!payload.number || !payload.title || !form.body.trim()) return;
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
          <div className="mt-3 flex gap-2">
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
              className={`${input} min-w-0 flex-1`}
            />
          </div>
          <textarea
            value={form.body}
            onChange={(e) =>
              setForm((f) => (f ? { ...f, body: e.target.value } : f))
            }
            placeholder={
              "Бүлгийн текст…\n\nДогол мөрүүдийг хоосон мөрөөр тусгаарлана."
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
                !form.title.trim() ||
                !form.body.trim() ||
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
