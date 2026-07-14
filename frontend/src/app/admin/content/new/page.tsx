"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { ApiError, adminApi } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import type { ContentDetail } from "@/lib/types";
import {
  ContentForm,
  ContentFormValues,
  EMPTY_FORM,
  toPayload,
} from "@/components/ContentForm";
import {
  MediaSection,
  SeasonsSection,
  VideoAssetsSection,
} from "@/components/AdminMedia";

/**
 * Two-step create: 1) basic info, 2) poster/backdrop/trailer/video uploads
 * on the same screen — no hunting for the edit page afterwards.
 */
export default function NewContentPage() {
  const { token } = useAuth();
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<ContentDetail | null>(null);

  const reload = useCallback(() => {
    if (!token || !created) return;
    adminApi
      .contentGet(token, created.id)
      .then(setCreated)
      .catch(() => undefined);
  }, [token, created]);

  async function create(values: ContentFormValues) {
    if (!token) return;
    setError("");
    setSubmitting(true);
    try {
      const content = await adminApi.contentCreate(token, toPayload(values));
      const detail = await adminApi.contentGet(token, content.id);
      setCreated(detail);
      toast.success("Контент үүслээ.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Хадгалахад алдаа гарлаа.");
      toast.error("Хадгалахад алдаа гарлаа.");
    } finally {
      setSubmitting(false);
    }
  }

  // ---- Step 2: uploads --------------------------------------------------
  if (created) {
    return (
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="display text-2xl font-semibold text-white">
            {created.title}
          </h1>
          <span className="text-sm font-semibold text-green-400">Үүслээ ✓</span>
        </div>
        <p className="mt-1 text-sm text-white/50">
          2-р алхам — зураг, трейлер, видео файлуудаа оруулна уу.
        </p>

        <div className="mt-6 grid max-w-4xl gap-6 lg:grid-cols-2">
          <MediaSection content={created} onChanged={reload} />
          {created.type === "SERIES" ? (
            <SeasonsSection content={created} onChanged={reload} />
          ) : (
            <VideoAssetsSection
              contentId={created.id}
              assets={created.videoAssets}
              onChanged={reload}
            />
          )}
        </div>

        <div className="mt-8 flex gap-3">
          <Link
            href={`/admin/content/${created.id}`}
            className="rounded-md border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Дэлгэрэнгүй засах
          </Link>
          <Link
            href="/admin/content"
            className="rounded-md bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-hover"
          >
            Дуусгах
          </Link>
        </div>
      </div>
    );
  }

  // ---- Step 1: basic info ------------------------------------------------
  return (
    <div>
      <h1 className="display text-2xl font-semibold text-white">Шинэ контент</h1>
      <p className="mt-1 text-sm text-white/50">
        1-р алхам — үндсэн мэдээлэл. Дараагийн алхамд зураг болон видео
        файлуудыг оруулна.
      </p>
      <div className="mt-6">
        <ContentForm
          initial={EMPTY_FORM}
          submitLabel="Үүсгэх → Дараах алхам"
          submitting={submitting}
          error={error}
          onSubmit={create}
        />
      </div>
    </div>
  );
}
