"use client";

import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { IconUpload } from "@/components/ui/icons";
import { useToast } from "@/components/ui/Toast";
import { Field } from "@/components/Field";
import { useAuth } from "@/lib/auth-context";
import { ApiError, activityApi, billingApi } from "@/lib/api";
import type { MySubscription } from "@/lib/types";
import { daysLeft, formatDate } from "@/lib/format";

/** Client-side pre-checks; the API re-validates everything. */
const AVATAR_MAX_BYTES = 4 * 1024 * 1024;
const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

export default function AccountPage() {
  return (
    <AppShell>
      <AccountContent />
    </AppShell>
  );
}

function AccountContent() {
  const { user, token, refresh } = useAuth();
  const toast = useToast();
  const [mine, setMine] = useState<MySubscription | null>(null);

  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);

  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(user?.name ?? "");
  }, [user?.name]);

  useEffect(() => {
    if (!token) return;
    billingApi
      .me(token)
      .then(setMine)
      .catch(() => undefined);
  }, [token]);

  if (!user) return null;
  const actives = mine?.actives ?? [];

  async function saveName() {
    if (!token) return;
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      toast.warning("Нэр хамгийн багадаа 2 тэмдэгт байна.");
      return;
    }
    setSavingName(true);
    try {
      await activityApi.updateProfile(token, { name: trimmed });
      await refresh();
      toast.success("Нэр хадгалагдлаа.");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Хадгалахад алдаа гарлаа.",
      );
    } finally {
      setSavingName(false);
    }
  }

  async function uploadAvatar(file: File) {
    if (!token) return;
    if (!AVATAR_TYPES.includes(file.type)) {
      toast.warning("Зөвхөн JPEG, PNG, WebP, AVIF зураг зөвшөөрөгдөнө.");
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      toast.warning("Зургийн хэмжээ 4MB-с ихгүй байх ёстой.");
      return;
    }
    setAvatarUploading(true);
    try {
      await activityApi.uploadAvatar(token, file);
      await refresh();
      toast.success("Профайл зураг шинэчлэгдлээ.");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Зураг хуулахад алдаа гарлаа.",
      );
    } finally {
      setAvatarUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:px-10">
      <PageHeader eyebrow="Тохиргоо" title="Миний бүртгэл" />

      {/* Membership card */}
      <div className="ticket-notch mt-6 rounded-2xl border border-line bg-surface shadow-card">
        <div className="flex items-center justify-between gap-4 px-6 pb-5 pt-6">
          <div className="flex min-w-0 items-center gap-4">
            {/* Avatar + uploader */}
            <div className="relative shrink-0">
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatarUrl}
                  alt="Профайл зураг"
                  className="h-20 w-20 rounded-full border border-line-strong object-cover"
                />
              ) : (
                <span className="grid h-20 w-20 place-items-center rounded-full bg-accent/20 text-3xl font-bold text-accent">
                  {(user.name?.[0] ?? user.phone[0]).toUpperCase()}
                </span>
              )}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={avatarUploading}
                aria-label="Профайл зураг солих"
                className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full border border-line bg-surface-raised text-foreground/80 shadow-card transition hover:bg-surface-overlay hover:text-foreground disabled:opacity-60"
              >
                {avatarUploading ? (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/25 border-t-accent" />
                ) : (
                  <IconUpload size={15} />
                )}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept={AVATAR_TYPES.join(",")}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadAvatar(file);
                }}
              />
            </div>

            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-muted">
                Шивнээ гишүүнчлэл
              </p>
              <p className="mt-1 truncate text-lg font-bold text-foreground">
                {user.name ?? user.phone}
              </p>
            </div>
          </div>

          <div className="shrink-0 text-right">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-muted">
              Гишүүний ID
            </p>
            <p className="display mt-1.5 text-xl font-semibold tracking-[0.12em] text-gold sm:text-2xl">
              USER-{user.publicId}
            </p>
          </div>
        </div>

        <div className="ticket-perforation mx-4 h-px" aria-hidden />

        <dl className="grid gap-4 px-6 pb-6 pt-5 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted">Утас</dt>
            <dd className="mt-0.5 text-sm text-foreground">{user.phone}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Имэйл</dt>
            <dd className="mt-0.5 truncate text-sm text-foreground">
              {user.email ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Бүртгүүлсэн</dt>
            <dd className="mt-0.5 text-sm text-foreground">
              {formatDate(user.createdAt)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Эрхийн байдал</dt>
            <dd className="mt-1 space-y-1.5 text-sm">
              {actives.length > 0 ? (
                actives.map((sub) => (
                  <span
                    key={sub.id}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <Badge tone="success">{sub.plan.name}</Badge>
                    <span className="text-foreground/80">
                      {daysLeft(sub.endsAt)} хоног үлдсэн
                    </span>
                  </span>
                ))
              ) : (
                <Badge tone="danger">Идэвхгүй</Badge>
              )}
            </dd>
          </div>
        </dl>
      </div>

      {/* Profile edit */}
      <section className="mt-8 rounded-2xl border border-line bg-surface p-6">
        <h2 className="text-base font-bold text-foreground">Профайл засах</h2>
        <div className="mt-4 max-w-sm">
          <Field
            label="Дэлгэцийн нэр"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Таны нэр"
            maxLength={60}
          />
          <Button variant="accent" loading={savingName} onClick={saveName}>
            Хадгалах
          </Button>
        </div>
      </section>

      <div className="mt-6 flex flex-wrap gap-3">
        <ButtonLink href="/plans" variant="primary">
          {actives.length > 0 ? "Эрх сунгах" : "Багц идэвхжүүлэх"}
        </ButtonLink>
        <ButtonLink href="/forgot" variant="outline">
          Нууц үг солих
        </ButtonLink>
      </div>
    </div>
  );
}
