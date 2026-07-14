"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthShell, AuthLink } from "@/components/AuthShell";
import { Field } from "@/components/Field";
import { OtpInput } from "@/components/OtpInput";
import { useAuth } from "@/lib/auth-context";
import { ApiError, authApi } from "@/lib/api";

type Step = "identifier" | "reset";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { adoptSession } = useAuth();

  const [step, setStep] = useState<Step>("identifier");
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [devCode, setDevCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function requestCode(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (identifier.trim().length < 3) {
      setError("Утасны дугаараа оруулна уу.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await authApi.forgotPassword({ identifier: identifier.trim() });
      setDevCode(res.otp?.devCode ?? "");
      setStep("reset");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Код илгээж чадсангүй.");
    } finally {
      setSubmitting(false);
    }
  }

  async function resetPassword(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (code.length !== 6) {
      setError("6 оронтой кодоо оруулна уу.");
      return;
    }
    if (password.length < 6) {
      setError("Нууц үг дор хаяж 6 тэмдэгт байх ёстой.");
      return;
    }
    if (password !== confirm) {
      setError("Нууц үг таарахгүй байна.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await authApi.resetPassword({
        identifier: identifier.trim(),
        code,
        newPassword: password,
      });
      // A successful reset signs the user straight in.
      adoptSession(res.accessToken, res.user);
      router.replace("/home");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Шинэчлэхэд алдаа гарлаа.");
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Нууц үг сэргээх"
      subtitle={
        step === "identifier"
          ? "Бүртгэлтэй утасны дугаараа оруулбал сэргээх код илгээнэ."
          : `${identifier} руу илгээсэн кодыг оруулаад шинэ нууц үгээ тохируулна уу.`
      }
      footer={
        <>
          Нууц үгээ санав уу? <AuthLink href="/login">Нэвтрэх</AuthLink>
        </>
      }
    >
      {error ? (
        <div className="mb-4 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      {step === "identifier" ? (
        <form onSubmit={requestCode} noValidate>
          <Field
            label="Утасны дугаар"
            name="identifier"
            type="tel"
            autoComplete="tel"
            placeholder="99xxxxxx"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
          />
          <button
            type="submit"
            disabled={submitting}
            className="mt-2 w-full rounded-lg bg-brand py-3 text-base font-bold text-white transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Илгээж байна…" : "Код илгээх"}
          </button>
        </form>
      ) : (
        <form onSubmit={resetPassword} noValidate>
          {devCode ? (
            <div className="mb-4 rounded-lg border border-gold/30 bg-gold/10 px-4 py-3 text-sm text-gold">
              Тест орчны код: <span className="font-mono font-bold">{devCode}</span>
            </div>
          ) : null}

          <div className="mb-5">
            <p className="mb-2 text-sm font-medium text-white/80">Сэргээх код</p>
            <OtpInput value={code} onChange={setCode} disabled={submitting} />
          </div>

          <Field
            label="Шинэ нууц үг"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="Дор хаяж 6 тэмдэгт"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Field
            label="Шинэ нууц үг давтах"
            name="confirm"
            type="password"
            autoComplete="new-password"
            placeholder="Нууц үгээ давтана уу"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 w-full rounded-lg bg-brand py-3 text-base font-bold text-white transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Шинэчилж байна…" : "Нууц үг шинэчлэх"}
          </button>

          <button
            type="button"
            onClick={() => setStep("identifier")}
            className="mt-4 w-full text-sm text-white/60 transition hover:text-white"
          >
            Өөр хаяг ашиглах
          </button>
        </form>
      )}
    </AuthShell>
  );
}
