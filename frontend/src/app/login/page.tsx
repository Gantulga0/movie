"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthShell, AuthLink } from "@/components/AuthShell";
import { Field } from "@/components/Field";
import { useAuth } from "@/lib/auth-context";
import { useWelcome } from "@/lib/welcome-context";
import { ApiError } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading: authLoading, login } = useAuth();
  const { play } = useWelcome();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ identifier?: string; password?: string }>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Fresh sign-in plays the cinematic hand-off; the welcome overlay owns the
  // navigation to /home once it has covered the screen.
  const [transitioning, setTransitioning] = useState(false);

  // Already-authenticated users skip the login page — but never yank the
  // screen away mid-animation for someone who just signed in.
  useEffect(() => {
    if (!authLoading && user && !transitioning) router.replace("/home");
  }, [authLoading, user, router, transitioning]);

  function validate() {
    const next: typeof errors = {};
    if (!identifier.trim()) next.identifier = "Утасны дугаараа оруулна уу.";
    else if (!/^\d{8}$/.test(identifier)) next.identifier = "Утасны дугаар яг 8 оронтой байх ёстой.";
    if (!password) next.password = "Нууц үгээ оруулна уу.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!validate()) return;

    setSubmitting(true);
    try {
      await login(identifier.trim(), password);
      // Suppress the auto-redirect and hand off to the ignition overlay,
      // which routes to /home once it has covered the screen.
      setTransitioning(true);
      play("/home");
    } catch (err) {
      // Unverified accounts get bounced to the OTP screen — the API already
      // sent a fresh code along with this error.
      if (err instanceof ApiError && err.code === "ACCOUNT_NOT_VERIFIED") {
        const otp = (err.data as { otp?: { target?: string; devCode?: string } })?.otp;
        const target = otp?.target ?? identifier.trim();
        router.replace(
          `/verify?identifier=${encodeURIComponent(target)}` +
            (otp?.devCode ? `&dev=${otp.devCode}` : ""),
        );
        return;
      }
      setFormError(
        err instanceof ApiError
          ? err.message
          : "Нэвтрэхэд алдаа гарлаа. Дахин оролдоно уу.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Тавтай морил"
      subtitle="Үргэлжлүүлэхийн тулд бүртгэлдээ нэвтэрнэ үү."
      footer={
        <>
          Бүртгэл байхгүй юу? <AuthLink href="/register">Бүртгүүлэх</AuthLink>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate>
        {formError ? (
          <div className="mb-4 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            {formError}
          </div>
        ) : null}

        <Field
          label="Утасны дугаар"
          name="identifier"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          maxLength={8}
          placeholder="99xxxxxx"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value.replace(/\D/g, "").slice(0, 8))}
          error={errors.identifier}
        />

        <Field
          label="Нууц үг"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
        />

        <div className="mb-4 text-right">
          <AuthLink href="/forgot">Нууц үгээ мартсан уу?</AuthLink>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 w-full rounded-lg bg-accent-strong py-3 text-base font-bold text-white shadow-[0_4px_20px_rgba(93,110,245,0.3)] transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Нэвтэрч байна…" : "Нэвтрэх"}
        </button>
      </form>
    </AuthShell>
  );
}
