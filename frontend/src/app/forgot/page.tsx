"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthShell, AuthLink } from "@/components/AuthShell";
import { Field } from "@/components/Field";
import { PhoneVerifyPrompt, VerifySession } from "@/components/PhoneVerifyPrompt";
import { useAuth } from "@/lib/auth-context";
import { ApiError, authApi } from "@/lib/api";

type Step = "identifier" | "verify" | "password";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { adoptSession } = useAuth();

  const [step, setStep] = useState<Step>("identifier");
  const [identifier, setIdentifier] = useState("");
  const [session, setSession] = useState<VerifySession | null>(null);
  // The verified session id used to apply the new password (may differ from the
  // first one if the user asked for a fresh code).
  const [verifiedSessionId, setVerifiedSessionId] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
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
      const v = res.verification;
      setSession({ sessionId: v.sessionId, code: v.code, smsUri: v.smsUri });
      setStep("verify");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Код авахад алдаа гарлаа.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitNewPassword(e: FormEvent) {
    e.preventDefault();
    setError("");
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
        sessionId: verifiedSessionId,
        newPassword: password,
      });
      // A successful reset signs the user straight in.
      adoptSession(res.accessToken, res.refreshToken, res.user);
      router.replace("/home");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Шинэчлэхэд алдаа гарлаа.");
      setSubmitting(false);
    }
  }

  const subtitle =
    step === "identifier"
      ? "Бүртгэлтэй утасны дугаараа оруулаад SMS-ээр баталгаажуулна уу."
      : step === "verify"
        ? "Доорх кодыг 144773 руу илгээж баталгаажуулна уу."
        : "Шинэ нууц үгээ тохируулна уу.";

  return (
    <AuthShell
      title="Нууц үг сэргээх"
      subtitle={subtitle}
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
            {submitting ? "Уншиж байна…" : "Үргэлжлүүлэх"}
          </button>
        </form>
      ) : null}

      {step === "verify" && session ? (
        <PhoneVerifyPrompt
          phone={identifier.trim()}
          session={session}
          poll={(sid) => authApi.resetStatus(sid)}
          restart={async (sid) => {
            const p = await authApi.verifyRestart(sid);
            return { sessionId: p.sessionId, code: p.code, smsUri: p.smsUri };
          }}
          onVerified={(_r, sessionId) => {
            setVerifiedSessionId(sessionId);
            setStep("password");
          }}
        />
      ) : null}

      {step === "password" ? (
        <form onSubmit={submitNewPassword} noValidate>
          <div className="mb-4 rounded-lg border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">
            Утас баталгаажлаа. Шинэ нууц үгээ тохируулна уу.
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
        </form>
      ) : null}
    </AuthShell>
  );
}
