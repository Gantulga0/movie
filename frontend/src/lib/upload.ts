"use client";

import { useEffect, useState } from "react";
import { storageApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

/** R2 configured → presigned direct upload; otherwise local disk upload. */
export function useStorageMode(): "r2" | "local" {
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

/** Upload a video file with whichever flow the backend supports. */
export async function uploadVideoFile(
  token: string,
  mode: "r2" | "local",
  folder: "videos" | "trailers",
  file: File,
  onProgress: (p: number) => void,
): Promise<{ key: string; url: string; mimeType: string }> {
  // Files like .mkv have no browser MIME type — presign and PUT must agree on
  // the same fallback or R2 rejects the signature with a 403.
  const mimeType = file.type || "video/mp4";
  if (mode === "r2") {
    const presigned = await storageApi.presign(token, {
      folder,
      filename: file.name,
      contentType: mimeType,
    });
    await storageApi.uploadDirect(presigned, file, onProgress, mimeType);
    return { key: presigned.key, url: presigned.url, mimeType };
  }
  const res = await storageApi.uploadVideoLocal(token, folder, file, onProgress);
  return { ...res, mimeType };
}
