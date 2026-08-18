"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ApiError, adminApi } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import type { ContentDetail } from "@/lib/types";
import {
  ContentForm,
  ContentFormValues,
  fromContent,
  toPayload,
} from "@/components/ContentForm";
import {
  MediaSection,
  SeasonsSection,
  VideoAssetsSection,
} from "@/components/AdminMedia";
import { ChaptersSection, SingleChapterSection } from "@/components/AdminChapters";

export default function EditContentPage() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const toast = useToast();

  const [content, setContent] = useState<ContentDetail | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    if (!token || !id) return;
    adminApi.contentGet(token, id).then(setContent).catch(() => undefined);
  }, [token, id]);

  useEffect(load, [load]);

  async function save(values: ContentFormValues) {
    if (!token || !content) return;
    setError("");
    setSubmitting(true);
    try {
      await adminApi.contentUpdate(token, content.id, toPayload(values));
      toast.success("Хадгалагдлаа.");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Хадгалахад алдаа гарлаа.");
      toast.error("Хадгалахад алдаа гарлаа.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!content) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-brand" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="display text-2xl font-semibold text-white">
        {content.title}
      </h1>

      <div className="mt-6 grid gap-10 xl:grid-cols-[1fr_420px]">
        {/* Media/video first on smaller screens so uploads are easy to reach */}
        <div className="space-y-8 xl:order-2">
          <MediaSection content={content} onChanged={load} />
          {content.type === "SERIES" ? (
            <SeasonsSection content={content} onChanged={load} />
          ) : content.type === "NOVEL" ? (
            content.singleChapter ? (
              <SingleChapterSection content={content} onChanged={load} />
            ) : (
              <ChaptersSection content={content} onChanged={load} />
            )
          ) : (
            <VideoAssetsSection
              contentId={content.id}
              assets={content.videoAssets}
              onChanged={load}
            />
          )}
        </div>

        <div className="xl:order-1">
          <ContentForm
            key={content.updatedAt}
            initial={fromContent(content)}
            submitLabel="Хадгалах"
            submitting={submitting}
            error={error}
            onSubmit={save}
          />
        </div>
      </div>
    </div>
  );
}
