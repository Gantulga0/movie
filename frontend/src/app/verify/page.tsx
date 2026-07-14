"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthShell, AuthLink } from "@/components/AuthShell";
import { OtpInput } from "@/components/OtpInput";
import { useAuth } from "@/lib/auth-context";
import { ApiError, authApi } from "@/lib/api";

const RESEND_COOLDOWN = 60;

function VerifyForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { verifyOtp } = useAuth();

  const identifier = params.get("identifier") ?? "";
  // Outside production the API returns the code so testing needs no inbox.
  const devCode = params.get("dev") ?? "";

  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN);

  useEffect(() => {
    if (!identifier) router.replace("/register");
  }, [identifier, router]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    if (code.length !== 6 || submitting) return;
    setError("");
    setSubmitting(true);
    try {
      await verifyOtp(identifier, code);
      router.replace("/home");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Баталгаажуулахад алдаа гарлаа.",
      );
      setSubmitting(false);
    }
  }

  // A full code submits itself.
  useEffect(() => {
    if (code.length === 6) void submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  async function resend() {
    setError("");
    setInfo("");
    try {
      const res = await authApi.resendOtp({ identifier, purpose: "VERIFY" });
      setCooldown(RESEND_COOLDOWN);
      setInfo(
        res.devCode
          ? `Шинэ код илгээлээ. (Тест код: ${res.devCode})`
          : "Шинэ код илгээлээ.",
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Код илгээж чадсангүй.");
    }
  }

  return (
    <AuthShell
      title="Баталгаажуулах"
      subtitle={`${identifier} дугаар руу илгээсэн 6 оронтой кодыг оруулна уу.`}
      footer={
        <>
          Буруу хаяг уу? <AuthLink href="/register">Дахин бүртгүүлэх</AuthLink>
        </>
      }
    >
      <form onSubmit={submit} noValidate>
        {error ? (
          <div className="mb-4 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        ) : null}
        {info ? (
          <div className="mb-4 rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-sm text-white/80">
            {info}
          </div>
        ) : null}
        {devCode && !info ? (
          <div className="mb-4 rounded-lg border border-gold/30 bg-gold/10 px-4 py-3 text-sm text-gold">
            Тест орчны код: <span className="font-mono font-bold">{devCode}</span>
          </div>
        ) : null}

        <OtpInput value={code} onChange={setCode} disabled={submitting} />

        <button
          type="submit"
          disabled={submitting || code.length !== 6}
          className="mt-6 w-full rounded-lg bg-brand py-3 text-base font-bold text-white transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Шалгаж байна…" : "Баталгаажуулах"}
        </button>

        <button
          type="button"
          onClick={resend}
          disabled={cooldown > 0}
          className="mt-4 w-full text-sm text-white/60 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {cooldown > 0 ? `Дахин илгээх (${cooldown}с)` : "Код дахин илгээх"}
        </button>
      </form>
    </AuthShell>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={null}>
      <VerifyForm />
    </Suspense>
  );
}
