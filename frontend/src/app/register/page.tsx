"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthShell, AuthLink } from "@/components/AuthShell";
import { Field } from "@/components/Field";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";

interface FormState {
  name: string;
  phone: string;
  password: string;
  confirmPassword: string;
}

type FieldErrors = Partial<Record<keyof FormState, string>>;

/** Mongolian mobile numbers are 8 digits (matches the login check). */
const PHONE_RE = /^\d{8}$/;

/** 0–3 password strength: length, extra length, letters+digits mix. */
function passwordStrength(pw: string): number {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 6) score += 1;
  if (pw.length >= 10) score += 1;
  if (/\d/.test(pw) && /[a-zA-Z]/.test(pw)) score += 1;
  return score;
}

const STRENGTH = [
  { label: "", color: "" },
  { label: "Сул", color: "bg-danger" },
  { label: "Дунд", color: "bg-gold" },
  { label: "Хүчтэй", color: "bg-success" },
];

export default function RegisterPage() {
  const router = useRouter();
  const { user, loading: authLoading, register } = useAuth();

  const [form, setForm] = useState<FormState>({
    name: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && user) router.replace("/home");
  }, [authLoading, user, router]);

  const strength = useMemo(
    () => passwordStrength(form.password),
    [form.password],
  );
  const confirmState: "empty" | "match" | "mismatch" =
    form.confirmPassword.length === 0
      ? "empty"
      : form.confirmPassword === form.password
        ? "match"
        : "mismatch";

  function update(key: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  function validate() {
    const next: FieldErrors = {};
    if (form.name.trim().length < 2) next.name = "Нэр дор хаяж 2 тэмдэгт байх ёстой.";
    if (!PHONE_RE.test(form.phone))
      next.phone = "8 оронтой утасны дугаар оруулна уу.";
    if (form.password.length < 6)
      next.password = "Нууц үг дор хаяж 6 тэмдэгт байх ёстой.";
    if (form.confirmPassword !== form.password)
      next.confirmPassword = "Нууц үг таарахгүй байна.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!validate()) return;

    setSubmitting(true);
    try {
      const res = await register({
        name: form.name.trim(),
        phone: form.phone.trim(),
        password: form.password,
      });
      // Account created — the verify screen shows the code to SMS to 144773.
      const v = res.verification;
      router.replace(
        `/verify?session=${encodeURIComponent(v.sessionId)}` +
          `&code=${encodeURIComponent(v.code)}` +
          `&phone=${encodeURIComponent(form.phone.trim())}`,
      );
    } catch (err) {
      setFormError(
        err instanceof ApiError
          ? err.message
          : "Бүртгүүлэхэд алдаа гарлаа. Дахин оролдоно уу.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Бүртгэл үүсгэх"
      subtitle="Утасны дугаараараа хэдхэн секундэд нэгдээрэй."
      footer={
        <>
          Бүртгэлтэй юу? <AuthLink href="/login">Нэвтрэх</AuthLink>
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
          label="Нэр"
          name="name"
          type="text"
          autoComplete="name"
          placeholder="Таны нэр"
          value={form.name}
          onChange={update("name")}
          error={errors.name}
        />

        {/* Phone — a +976 chip grounds it as a Mongolian number (verify.mn only
            confirms MN phones), and the input itself stays the 8 local digits. */}
        <div className="mb-1">
          <label
            htmlFor="phone"
            className="mb-1.5 block text-sm font-medium text-white/80"
          >
            Утасны дугаар
          </label>
          <div
            className={`flex items-center overflow-hidden rounded-xl border bg-white/5 transition focus-within:border-accent/40 focus-within:bg-white/10 ${
              errors.phone ? "border-brand/70" : "border-line"
            }`}
          >
            <span className="select-none border-r border-line px-3 py-3 text-sm font-semibold text-muted">
              +976
            </span>
            <input
              id="phone"
              name="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              maxLength={8}
              placeholder="99xxxxxx"
              value={form.phone}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  phone: e.target.value.replace(/\D/g, "").slice(0, 8),
                }))
              }
              className="no-focus-ring w-full bg-transparent px-4 py-3 text-white placeholder-white/35 outline-none"
              aria-invalid={errors.phone ? true : undefined}
            />
          </div>
          <p
            className={`mt-1.5 text-xs ${errors.phone ? "text-brand" : "text-muted/70"}`}
          >
            {errors.phone ?? "Бүртгэлээ 144773 руу SMS илгээж баталгаажуулна."}
          </p>
        </div>

        <div className="mt-4">
          <Field
            label="Нууц үг"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="Дор хаяж 6 тэмдэгт"
            value={form.password}
            onChange={update("password")}
            error={errors.password}
          />
          {form.password && !errors.password ? (
            <div className="-mt-2.5 mb-4 flex items-center gap-2">
              <div className="flex flex-1 gap-1">
                {[1, 2, 3].map((seg) => (
                  <span
                    key={seg}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                      seg <= strength ? STRENGTH[strength].color : "bg-white/12"
                    }`}
                  />
                ))}
              </div>
              <span className="w-12 shrink-0 text-right text-[11px] font-medium text-muted">
                {STRENGTH[strength].label}
              </span>
            </div>
          ) : null}
        </div>

        <Field
          label="Нууц үг баталгаажуулах"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          placeholder="Нууц үгээ давтана уу"
          value={form.confirmPassword}
          onChange={update("confirmPassword")}
          error={errors.confirmPassword}
        />
        {confirmState !== "empty" && !errors.confirmPassword ? (
          <p
            className={`-mt-2.5 mb-4 text-xs font-medium ${
              confirmState === "match" ? "text-success" : "text-danger"
            }`}
          >
            {confirmState === "match" ? "✓ Нууц үг таарлаа" : "✕ Нууц үг таарахгүй байна"}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="group mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-accent-strong py-3 text-base font-bold text-white shadow-[0_4px_20px_rgba(93,110,245,0.3)] transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Бүртгэж байна…" : "Бүртгүүлэх"}
          {!submitting ? (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden
              className="transition-transform group-hover:translate-x-0.5"
            >
              <path
                d="M5 12h14M13 6l6 6-6 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : null}
        </button>

        <p className="mt-4 text-center text-xs leading-relaxed text-muted/80">
          Бүртгүүлснээр та үйлчилгээний нөхцөл болон нууцлалын бодлогыг
          зөвшөөрч байна.
        </p>
      </form>
    </AuthShell>
  );
}
